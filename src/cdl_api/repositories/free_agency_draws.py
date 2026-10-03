"""Free-agency draw persistence and deterministic award processing."""

from collections.abc import Callable
from datetime import UTC, datetime
from random import SystemRandom
from uuid import uuid4

from sqlalchemy import delete, func, insert, or_, select, update
from sqlalchemy.orm import Session

from cdl_api.contracts.free_agency import (
    FreeAgencyDrawCreateRequest,
    FreeAgencyDrawResponse,
    FreeAgencyDrawStatus,
    FreeAgencyManagerResult,
    FreeAgencyPreference,
    FreeAgencyPreferencesRequest,
    FreeAgencyPublicAward,
    FreeAgencyResultsResponse,
)
from cdl_api.repositories.postgres_fpl_data import fpl_gameweeks_table
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    fpl_players_table,
    fpl_positions_table,
    league_memberships_table,
    managers_table,
    seasons_table,
)
from cdl_api.repositories.postgres_squad import (
    free_agency_draw_order_table,
    free_agency_draws_table,
    free_agency_events_table,
    free_agency_preferences_table,
    free_agency_results_table,
    player_rights_table,
    squad_ownerships_table,
    squad_roster_slots_table,
)
from cdl_api.staging_draft_seed import LEAGUE_ID, SEASON_ID


class PostgreSQLFreeAgencyDrawRepository:
    """Persist private ranked preferences and public deterministic draw results."""

    def __init__(
        self,
        session_factory: Callable[[], Session],
        user_id: str,
        manager_id: str,
        team_id: str,
    ) -> None:
        self._session_factory = session_factory
        self.user_id = user_id
        self.manager_id = manager_id
        self.team_id = team_id
        self.season_id = SEASON_ID

    def is_commissioner(self, league_id: str = LEAGUE_ID) -> bool:
        with self._session_factory() as session:
            role = session.execute(
                select(league_memberships_table.c.role)
                .join(managers_table, managers_table.c.id == league_memberships_table.c.manager_id)
                .where(
                    managers_table.c.user_id == self.user_id,
                    league_memberships_table.c.league_id == league_id,
                )
            ).scalar_one_or_none()
        return role == "commissioner"

    def create_draw(self, request: FreeAgencyDrawCreateRequest) -> FreeAgencyDrawResponse:
        now = datetime.now(UTC)
        opens_at = request.opens_at or now
        if request.closes_at <= opens_at:
            raise ValueError("Preference close must be later than the open time.")
        draw_id = f"free-agency-{self.season_id}-gw-{request.gameweek}"
        with self._session_factory() as session:
            session.execute(
                insert(free_agency_draws_table).values(
                    id=draw_id,
                    season_id=self.season_id,
                    gameweek=request.gameweek,
                    status=FreeAgencyDrawStatus.SCHEDULED.value,
                    opens_at=opens_at,
                    closes_at=request.closes_at,
                    processed_at=None,
                    created_at=now,
                )
            )
            self._event(session, draw_id, "draw_scheduled", self.manager_id, now)
            session.commit()
        return self.get_draw(draw_id)

    def get_draw(self, draw_id: str) -> FreeAgencyDrawResponse | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(free_agency_draws_table).where(
                        free_agency_draws_table.c.id == draw_id,
                        free_agency_draws_table.c.season_id == self.season_id,
                    )
                )
                .mappings()
                .first()
            )
            order = list(
                session.execute(
                    select(free_agency_draw_order_table.c.draft_team_id)
                    .where(free_agency_draw_order_table.c.draw_id == draw_id)
                    .order_by(free_agency_draw_order_table.c.position)
                ).scalars()
            )
        return (
            None if row is None else self._draw_from_row(row, [str(team_id) for team_id in order])
        )

    def list_draws(self) -> list[FreeAgencyDrawResponse]:
        with self._session_factory() as session:
            draw_ids = list(
                session.execute(
                    select(free_agency_draws_table.c.id)
                    .where(free_agency_draws_table.c.season_id == self.season_id)
                    .order_by(free_agency_draws_table.c.gameweek)
                ).scalars()
            )
        return [draw for draw_id in draw_ids if (draw := self.get_draw(str(draw_id))) is not None]

    def set_draw_status(
        self, draw_id: str, status: FreeAgencyDrawStatus, action: str
    ) -> FreeAgencyDrawResponse | None:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            result = session.execute(
                update(free_agency_draws_table)
                .where(
                    free_agency_draws_table.c.id == draw_id,
                    free_agency_draws_table.c.season_id == self.season_id,
                )
                .values(status=status.value)
            )
            if not result.rowcount:
                return None
            self._event(session, draw_id, action, self.manager_id, now)
            session.commit()
        return self.get_draw(draw_id)

    def submit_preferences(
        self, draw_id: str, request: FreeAgencyPreferencesRequest
    ) -> list[FreeAgencyPreference]:
        now = datetime.now(UTC)
        player_ids = request.player_ids
        if len(player_ids) != len(set(player_ids)):
            raise ValueError("Player IDs in ranked preferences must be unique.")
        with self._session_factory() as session:
            draw = (
                session.execute(
                    select(free_agency_draws_table)
                    .where(
                        free_agency_draws_table.c.id == draw_id,
                        free_agency_draws_table.c.season_id == self.season_id,
                    )
                    .with_for_update()
                )
                .mappings()
                .first()
            )
            if draw is None:
                raise LookupError("Free-agency draw not found.")
            if draw["status"] != FreeAgencyDrawStatus.OPEN_FOR_PREFERENCES.value:
                raise ValueError("This draw is not open for preferences.")
            if _as_utc(draw["closes_at"]) <= now:
                raise ValueError("The preference deadline has passed.")

            available = self._available_player_ids(session, now)
            unavailable = [player_id for player_id in player_ids if player_id not in available]
            if unavailable:
                raise ValueError("Preferences may only include currently available players.")
            session.execute(
                delete(free_agency_preferences_table).where(
                    free_agency_preferences_table.c.draw_id == draw_id,
                    free_agency_preferences_table.c.draft_team_id == self.team_id,
                )
            )
            for rank, player_id in enumerate(player_ids, start=1):
                session.execute(
                    insert(free_agency_preferences_table).values(
                        id=f"free-agency-pref-{uuid4().hex[:12]}",
                        draw_id=draw_id,
                        draft_team_id=self.team_id,
                        manager_id=self.manager_id,
                        player_id=player_id,
                        rank=rank,
                        submitted_at=now,
                    )
                )
            self._event(session, draw_id, "preferences_saved", self.manager_id, now)
            session.commit()
        return [
            FreeAgencyPreference(player_id=player_id, rank=index)
            for index, player_id in enumerate(player_ids, 1)
        ]

    def preferences(self, draw_id: str) -> list[FreeAgencyPreference]:
        with self._session_factory() as session:
            rows = list(
                session.execute(
                    select(
                        free_agency_preferences_table.c.player_id,
                        free_agency_preferences_table.c.rank,
                    )
                    .where(
                        free_agency_preferences_table.c.draw_id == draw_id,
                        free_agency_preferences_table.c.draft_team_id == self.team_id,
                    )
                    .order_by(free_agency_preferences_table.c.rank)
                ).mappings()
            )
        return [FreeAgencyPreference(player_id=row["player_id"], rank=row["rank"]) for row in rows]

    def process_draw(self, draw_id: str) -> FreeAgencyDrawResponse | None:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            with session.begin():
                season_exists = session.execute(
                    select(seasons_table.c.id)
                    .where(seasons_table.c.id == self.season_id)
                    .with_for_update()
                ).scalar_one_or_none()
                if season_exists is None:
                    raise ValueError("The free-agency draw season is not configured.")
                draw = (
                    session.execute(
                        select(free_agency_draws_table)
                        .where(
                            free_agency_draws_table.c.id == draw_id,
                            free_agency_draws_table.c.season_id == self.season_id,
                        )
                        .with_for_update()
                    )
                    .mappings()
                    .first()
                )
                if draw is None:
                    return None
                if draw["status"] == FreeAgencyDrawStatus.PROCESSED.value:
                    return self.get_draw(draw_id)
                if (
                    draw["status"]
                    not in {
                        FreeAgencyDrawStatus.LOCKED.value,
                        FreeAgencyDrawStatus.OPEN_FOR_PREFERENCES.value,
                    }
                    or _as_utc(draw["closes_at"]) > now
                ):
                    raise ValueError(
                        "The draw must be locked or past its close time before processing."
                    )

                deadline = session.execute(
                    select(fpl_gameweeks_table.c.deadline_time).where(
                        fpl_gameweeks_table.c.id == str(draw["gameweek"])
                    )
                ).scalar_one_or_none()
                if deadline is None or _as_utc(deadline) <= now:
                    raise ValueError("The FPL deadline must be configured and in the future.")

                teams = list(
                    session.execute(
                        select(draft_teams_table.c.id).where(
                            draft_teams_table.c.league_id == LEAGUE_ID,
                            draft_teams_table.c.manager_id.is_not(None),
                        )
                    ).scalars()
                )
                SystemRandom().shuffle(teams)
                session.execute(
                    update(free_agency_draws_table)
                    .where(free_agency_draws_table.c.id == draw_id)
                    .values(status=FreeAgencyDrawStatus.PROCESSING.value)
                )
                for position, team_id in enumerate(teams, start=1):
                    session.execute(
                        insert(free_agency_draw_order_table).values(
                            id=f"free-agency-order-{uuid4().hex[:12]}",
                            draw_id=draw_id,
                            draft_team_id=team_id,
                            position=position,
                        )
                    )
                available = self._available_player_ids(session, now)
                preference_rows = list(
                    session.execute(
                        select(
                            free_agency_preferences_table.c.draft_team_id,
                            free_agency_preferences_table.c.player_id,
                            free_agency_preferences_table.c.rank,
                        )
                        .where(free_agency_preferences_table.c.draw_id == draw_id)
                        .order_by(
                            free_agency_preferences_table.c.draft_team_id,
                            free_agency_preferences_table.c.rank,
                        )
                    ).mappings()
                )
                preferences_by_team: dict[str, list[tuple[str, int]]] = {}
                for row in preference_rows:
                    preferences_by_team.setdefault(str(row["draft_team_id"]), []).append(
                        (str(row["player_id"]), int(row["rank"]))
                    )
                auto_added_team_ids: set[str] = set()
                for team_id in teams:
                    won = next(
                        (
                            (player_id, rank)
                            for player_id, rank in preferences_by_team.get(str(team_id), [])
                            if player_id in available
                        ),
                        None,
                    )
                    right_id = None
                    if won is not None:
                        player_id, rank = won
                        available.remove(player_id)
                        right_id = f"free-agency-right-{uuid4().hex[:12]}"
                        position_name = session.execute(
                            select(fpl_positions_table.c.singular_name)
                            .join(
                                fpl_players_table,
                                fpl_players_table.c.position_id == fpl_positions_table.c.id,
                            )
                            .where(fpl_players_table.c.id == player_id)
                        ).scalar_one_or_none()
                        position_id = session.execute(
                            select(fpl_players_table.c.position_id).where(
                                fpl_players_table.c.id == player_id
                            )
                        ).scalar_one_or_none()
                        active_count = session.execute(
                            select(func.count())
                            .select_from(squad_ownerships_table)
                            .where(
                                squad_ownerships_table.c.season_id == self.season_id,
                                squad_ownerships_table.c.draft_team_id == team_id,
                                squad_ownerships_table.c.ended_at.is_(None),
                            )
                        ).scalar_one()
                        same_position_count = session.execute(
                            select(func.count())
                            .select_from(
                                squad_ownerships_table.join(
                                    fpl_players_table,
                                    fpl_players_table.c.id == squad_ownerships_table.c.player_id,
                                ).join(
                                    fpl_positions_table,
                                    fpl_positions_table.c.id == fpl_players_table.c.position_id,
                                )
                            )
                            .where(
                                squad_ownerships_table.c.season_id == self.season_id,
                                squad_ownerships_table.c.draft_team_id == team_id,
                                squad_ownerships_table.c.ended_at.is_(None),
                                fpl_positions_table.c.singular_name == position_name,
                            )
                        ).scalar_one()
                        positional_cap = {
                            "goalkeeper": 3,
                            "defender": 10,
                            "midfielder": 10,
                            "forward": 4,
                        }.get(str(position_name).casefold(), 0)
                        auto_added = active_count < 20 and same_position_count < positional_cap
                        slot_id = None
                        if auto_added:
                            slot_id = session.execute(
                                select(squad_roster_slots_table.c.id)
                                .select_from(
                                    squad_roster_slots_table.outerjoin(
                                        squad_ownerships_table,
                                        (
                                            squad_ownerships_table.c.roster_slot_id
                                            == squad_roster_slots_table.c.id
                                        )
                                        & (squad_ownerships_table.c.season_id == self.season_id)
                                        & squad_ownerships_table.c.ended_at.is_(None),
                                    )
                                )
                                .where(
                                    squad_roster_slots_table.c.season_id == self.season_id,
                                    squad_roster_slots_table.c.draft_team_id == team_id,
                                    or_(
                                        squad_roster_slots_table.c.position_id == position_id,
                                        squad_roster_slots_table.c.position_id.is_(None),
                                    ),
                                    squad_ownerships_table.c.id.is_(None),
                                )
                                .order_by(squad_roster_slots_table.c.sort_order)
                                .limit(1)
                                .with_for_update(of=squad_roster_slots_table)
                            ).scalar_one_or_none()
                            auto_added = slot_id is not None
                        if auto_added:
                            auto_added_team_ids.add(str(team_id))
                            session.execute(
                                insert(squad_ownerships_table).values(
                                    id=f"ownership-free-agency-{uuid4().hex[:12]}",
                                    season_id=self.season_id,
                                    draft_team_id=team_id,
                                    player_id=player_id,
                                    roster_slot_id=slot_id,
                                    started_at=now,
                                    ended_at=None,
                                )
                            )
                        session.execute(
                            insert(player_rights_table).values(
                                id=right_id,
                                season_id=self.season_id,
                                draft_team_id=team_id,
                                player_id=player_id,
                                right_type="free_agency_draw",
                                source_ref=draw_id,
                                acquired_at=now,
                                expires_at=deadline,
                                released_at=now if auto_added else None,
                            )
                        )
                        result_player_id, result_rank, reason = player_id, rank, "awarded"
                    else:
                        result_player_id = result_rank = None
                        reason = (
                            "no_available_preference"
                            if preferences_by_team.get(str(team_id))
                            else "no_preferences"
                        )
                    session.execute(
                        insert(free_agency_results_table).values(
                            id=f"free-agency-result-{uuid4().hex[:12]}",
                            draw_id=draw_id,
                            draft_team_id=team_id,
                            player_id=result_player_id,
                            preference_rank=result_rank,
                            reason_code=reason,
                            temporary_right_id=right_id,
                            created_at=now,
                        )
                    )
                session.execute(
                    update(free_agency_draws_table)
                    .where(free_agency_draws_table.c.id == draw_id)
                    .values(status=FreeAgencyDrawStatus.PROCESSED.value, processed_at=now)
                )
                self._event(session, draw_id, "draw_processed", self.manager_id, now)
                if auto_added_team_ids:
                    from cdl_api.repositories.postgres_team_selection import (
                        PostgreSQLTeamSelectionRepository,
                    )

                    for team_id in auto_added_team_ids:
                        owned_ids = set(
                            session.execute(
                                select(squad_ownerships_table.c.player_id).where(
                                    squad_ownerships_table.c.season_id == self.season_id,
                                    squad_ownerships_table.c.draft_team_id == team_id,
                                    squad_ownerships_table.c.ended_at.is_(None),
                                )
                            ).scalars()
                        )
                        PostgreSQLTeamSelectionRepository.repair_unlocked_lineups(
                            session, team_id, owned_ids, now
                        )
        return self.get_draw(draw_id)

    def results(self, draw_id: str) -> FreeAgencyResultsResponse | None:
        draw = self.get_draw(draw_id)
        if draw is None:
            return None
        with self._session_factory() as session:
            rows = list(
                session.execute(
                    select(
                        free_agency_results_table.c.draft_team_id,
                        draft_teams_table.c.name.label("team_name"),
                        free_agency_results_table.c.player_id,
                        fpl_players_table.c.web_name.label("player_name"),
                        free_agency_results_table.c.preference_rank,
                        free_agency_results_table.c.reason_code,
                    )
                    .join(
                        draft_teams_table,
                        draft_teams_table.c.id == free_agency_results_table.c.draft_team_id,
                    )
                    .outerjoin(
                        fpl_players_table,
                        fpl_players_table.c.id == free_agency_results_table.c.player_id,
                    )
                    .where(free_agency_results_table.c.draw_id == draw_id)
                ).mappings()
            )
        awards = [
            FreeAgencyPublicAward(
                draft_team_id=row["draft_team_id"],
                team_name=row["team_name"],
                player_id=row["player_id"],
                player_name=row["player_name"],
            )
            for row in rows
            if row["player_id"] is not None
        ]
        own_row = next((row for row in rows if row["draft_team_id"] == self.team_id), None)
        own_result = (
            None
            if own_row is None
            else FreeAgencyManagerResult(
                draft_team_id=self.team_id,
                won_player_id=own_row["player_id"],
                preference_rank=own_row["preference_rank"],
                reason_code=own_row["reason_code"],
            )
        )
        return FreeAgencyResultsResponse(
            draw=draw,
            awards=awards,
            own_preferences=self.preferences(draw_id),
            own_result=own_result,
        )

    def _available_player_ids(self, session: Session, now: datetime) -> set[str]:
        players = set(session.execute(select(fpl_players_table.c.id)).scalars())
        owned = set(
            session.execute(
                select(squad_ownerships_table.c.player_id).where(
                    squad_ownerships_table.c.season_id == self.season_id,
                    squad_ownerships_table.c.ended_at.is_(None),
                )
            ).scalars()
        )
        rights = set(
            session.execute(
                select(player_rights_table.c.player_id).where(
                    player_rights_table.c.season_id == self.season_id,
                    player_rights_table.c.released_at.is_(None),
                    or_(
                        player_rights_table.c.expires_at.is_(None),
                        player_rights_table.c.expires_at > now,
                    ),
                )
            ).scalars()
        )
        return {str(player_id) for player_id in players - owned - rights}

    def _event(
        self,
        session: Session,
        draw_id: str,
        action: str,
        actor_manager_id: str | None,
        now: datetime,
    ) -> None:
        session.execute(
            insert(free_agency_events_table).values(
                id=f"free-agency-event-{uuid4().hex[:12]}",
                draw_id=draw_id,
                actor_manager_id=actor_manager_id,
                action=action,
                created_at=now,
                metadata_json={},
            )
        )

    @staticmethod
    def _draw_from_row(row: object, order: list[str]) -> FreeAgencyDrawResponse:
        return FreeAgencyDrawResponse(
            id=row["id"],
            season_id=row["season_id"],
            gameweek=row["gameweek"],
            status=FreeAgencyDrawStatus(row["status"]),
            opens_at=_as_utc(row["opens_at"]) if row["opens_at"] is not None else None,
            closes_at=_as_utc(row["closes_at"]),
            processed_at=_as_utc(row["processed_at"]) if row["processed_at"] is not None else None,
            draw_order=order,
        )


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
