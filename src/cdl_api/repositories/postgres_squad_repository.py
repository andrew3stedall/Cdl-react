"""PostgreSQL-backed squad interest and trade repository."""

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Integer, cast, exists, func, insert, literal, or_, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.sql.selectable import Subquery

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.squad import (
    InterestResponse,
    PlayerDetail,
    PlayerNextFixture,
    PlayerOwnershipStatus,
    ScoutingFilters,
    TradeAsset,
    TradeProposal,
    TradeStatus,
)
from cdl_api.repositories.postgres_fpl_data import (
    fpl_fixtures_table,
    fpl_gameweeks_table,
    fpl_player_current_metrics_table,
)
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    epl_teams_table,
    fpl_player_availability_table,
    fpl_player_values_table,
    fpl_players_table,
)
from cdl_api.repositories.postgres_squad import (
    player_rights_table,
    squad_interests_table,
    squad_ownerships_table,
    trade_assets_table,
    trade_proposals_table,
)
from cdl_api.repositories.squad import InMemorySquadRepository
from cdl_api.staging_draft_seed import (
    PRIMARY_MANAGER_ID,
    PRIMARY_TEAM_ID,
    SEASON_ID,
    TEAM_IDS,
    TEAM_NAMES,
    resolve_staging_manager_context,
)

DEMO_SEASON_ID = SEASON_ID
DEMO_MANAGER_ID = PRIMARY_MANAGER_ID
DEMO_RIVAL_MANAGER_ID = "manager-2"


def _active_gameweek_player_values_subquery() -> Subquery:
    """Select player prices for the current FPL season/gameweek.

    Player values are retained by gameweek for auditability. A plain maximum
    gameweek lookup is incorrect at a season rollover because the new season
    starts at gameweek 1 while last season's gameweek 38 rows still exist.
    Prefer the official current gameweek, falling back to the official next
    gameweek during the pre-season window.
    """
    active_gameweek = (
        select(cast(fpl_gameweeks_table.c.id, Integer))
        .where(
            or_(
                fpl_gameweeks_table.c.is_current.is_(True),
                fpl_gameweeks_table.c.is_next.is_(True),
            )
        )
        .order_by(
            fpl_gameweeks_table.c.is_current.desc(),
            fpl_gameweeks_table.c.is_next.desc(),
            fpl_gameweeks_table.c.deadline_time.asc().nulls_last(),
        )
        .limit(1)
        .scalar_subquery()
    )
    return (
        select(
            fpl_player_values_table.c.player_id,
            func.max(fpl_player_values_table.c.gameweek).label("gameweek"),
        )
        .where(fpl_player_values_table.c.gameweek == active_gameweek)
        .group_by(fpl_player_values_table.c.player_id)
        .subquery("active_gameweek_player_values")
    )


class PostgreSQLSquadRepository(InMemorySquadRepository):
    def __init__(
        self,
        session_factory: Callable[[], Session],
        user_id: str | None = None,
    ) -> None:
        super().__init__()
        self._session_factory = session_factory
        self.manager_team = TeamSummary(id=PRIMARY_TEAM_ID, name=TEAM_NAMES[0])
        self.rival_team = TeamSummary(id=TEAM_IDS[1], name=TEAM_NAMES[1])
        self._manager_id = DEMO_MANAGER_ID
        self._players_cache: list[PlayerDetail] | None = None

        context = resolve_staging_manager_context(session_factory, user_id)
        if context is not None:
            (
                self._manager_id,
                manager_team_id,
                manager_team_name,
                rival_team_id,
                rival_team_name,
            ) = context
            self.manager_team = TeamSummary(id=manager_team_id, name=manager_team_name)
            self.rival_team = TeamSummary(id=rival_team_id, name=rival_team_name)

    def seed_demo_data(self) -> None:
        """Seed hooks are owned by imports in #69; runtime writes are persisted here."""

    def _database_players(self) -> list[PlayerDetail]:
        if self._players_cache is not None:
            return self._players_cache

        active_ownerships = squad_ownerships_table.alias("active_ownerships")
        canonical_players = fpl_players_table.alias("canonical_players")
        latest_values = _active_gameweek_player_values_subquery()
        legacy_without_canonical_counterpart = ~exists(
            select(1)
            .select_from(canonical_players)
            .where(canonical_players.c.id == literal("fpl-") + fpl_players_table.c.id)
        )
        with self._session_factory() as session:
            rows = list(
                session.execute(
                    select(
                        fpl_players_table.c.id,
                        fpl_players_table.c.web_name,
                        fpl_players_table.c.position_id,
                        epl_teams_table.c.id.label("epl_team_id"),
                        epl_teams_table.c.name.label("epl_team_name"),
                        epl_teams_table.c.short_name.label("epl_team_short_name"),
                        draft_teams_table.c.id.label("draft_team_id"),
                        draft_teams_table.c.name.label("draft_team_name"),
                        active_ownerships.c.id.label("ownership_id"),
                        fpl_player_values_table.c.value.label("current_value"),
                        fpl_player_availability_table.c.status.label("availability_status"),
                        fpl_player_availability_table.c.news.label("availability_news"),
                        fpl_player_current_metrics_table.c.total_points,
                        fpl_player_current_metrics_table.c.form,
                        fpl_player_current_metrics_table.c.selected_by_percent,
                        fpl_player_current_metrics_table.c.minutes,
                        fpl_player_current_metrics_table.c.goals_scored,
                        fpl_player_current_metrics_table.c.assists,
                        fpl_player_current_metrics_table.c.clean_sheets,
                        fpl_player_current_metrics_table.c.expected_goals,
                        fpl_player_current_metrics_table.c.expected_assists,
                        fpl_player_current_metrics_table.c.chance_of_playing_next_round,
                    )
                    .join(epl_teams_table, fpl_players_table.c.team_id == epl_teams_table.c.id)
                    .outerjoin(
                        latest_values,
                        latest_values.c.player_id == fpl_players_table.c.id,
                    )
                    .outerjoin(
                        fpl_player_values_table,
                        (fpl_player_values_table.c.player_id == fpl_players_table.c.id)
                        & (fpl_player_values_table.c.gameweek == latest_values.c.gameweek),
                    )
                    .outerjoin(
                        fpl_player_availability_table,
                        fpl_player_availability_table.c.player_id == fpl_players_table.c.id,
                    )
                    .outerjoin(
                        fpl_player_current_metrics_table,
                        fpl_player_current_metrics_table.c.player_id == fpl_players_table.c.id,
                    )
                    .outerjoin(
                        active_ownerships,
                        (active_ownerships.c.player_id == fpl_players_table.c.id)
                        & (active_ownerships.c.season_id == DEMO_SEASON_ID)
                        & active_ownerships.c.ended_at.is_(None),
                    )
                    .outerjoin(
                        draft_teams_table,
                        active_ownerships.c.draft_team_id == draft_teams_table.c.id,
                    )
                    .where(
                        or_(
                            fpl_players_table.c.id.like("fpl-%"),
                            legacy_without_canonical_counterpart,
                        )
                    )
                    .order_by(active_ownerships.c.id, fpl_players_table.c.web_name)
                ).mappings()
            )
            next_fixtures = self._next_fixtures_by_team(session)
        self._players_cache = [
            self._player_from_database_row(row, next_fixtures.get(row["epl_team_id"]))
            for row in rows
        ]
        return self._players_cache

    def _invalidate_players_cache(self) -> None:
        self._players_cache = None

    @staticmethod
    def _next_fixtures_by_team(session: Session) -> dict[str, PlayerNextFixture]:
        home_team = epl_teams_table.alias("fixture_home_team")
        away_team = epl_teams_table.alias("fixture_away_team")
        try:
            rows = list(
                session.execute(
                    select(
                        fpl_fixtures_table.c.id,
                        fpl_fixtures_table.c.gameweek,
                        fpl_fixtures_table.c.home_team_id,
                        fpl_fixtures_table.c.away_team_id,
                        fpl_fixtures_table.c.kickoff_time,
                        fpl_fixtures_table.c.home_difficulty,
                        fpl_fixtures_table.c.away_difficulty,
                        home_team.c.name.label("home_team_name"),
                        home_team.c.short_name.label("home_team_short_name"),
                        away_team.c.name.label("away_team_name"),
                        away_team.c.short_name.label("away_team_short_name"),
                    )
                    .join(home_team, fpl_fixtures_table.c.home_team_id == home_team.c.id)
                    .join(away_team, fpl_fixtures_table.c.away_team_id == away_team.c.id)
                    .where(
                        fpl_fixtures_table.c.started.is_(False),
                        fpl_fixtures_table.c.finished.is_(False),
                    )
                    .order_by(fpl_fixtures_table.c.kickoff_time.asc().nulls_last())
                ).mappings()
            )
        except SQLAlchemyError:
            return {}
        fixtures: dict[str, PlayerNextFixture] = {}
        for row in rows:
            gameweek_number = row["gameweek"]
            gameweek = (
                GameweekSummary(
                    id=f"gw-{gameweek_number}",
                    name=f"Gameweek {gameweek_number}",
                    number=int(gameweek_number),
                )
                if gameweek_number is not None
                else None
            )
            home_fixture = PlayerNextFixture(
                fixture_id=str(row["id"]),
                gameweek=gameweek,
                opponent=TeamSummary(
                    id=str(row["away_team_id"]),
                    name=str(row["away_team_name"]),
                    short_name=str(row["away_team_short_name"]),
                ),
                difficulty=row["home_difficulty"],
                is_home=True,
                kickoff_at=row["kickoff_time"],
            )
            away_fixture = PlayerNextFixture(
                fixture_id=str(row["id"]),
                gameweek=gameweek,
                opponent=TeamSummary(
                    id=str(row["home_team_id"]),
                    name=str(row["home_team_name"]),
                    short_name=str(row["home_team_short_name"]),
                ),
                difficulty=row["away_difficulty"],
                is_home=False,
                kickoff_at=row["kickoff_time"],
            )
            fixtures.setdefault(str(row["home_team_id"]), home_fixture)
            fixtures.setdefault(str(row["away_team_id"]), away_fixture)
        return fixtures

    @staticmethod
    def _player_from_database_row(
        row: object,
        next_fixture: PlayerNextFixture | None = None,
    ) -> PlayerDetail:
        epl_team = TeamSummary(
            id=row["epl_team_id"],
            name=row["epl_team_name"],
            short_name=row["epl_team_short_name"],
        )
        draft_team = (
            TeamSummary(id=row["draft_team_id"], name=row["draft_team_name"])
            if row["draft_team_id"] is not None
            else None
        )
        return PlayerDetail(
            id=row["id"],
            display_name=row["web_name"],
            position=row["position_id"],
            team=epl_team,
            epl_team=epl_team,
            draft_team=draft_team,
            status=(
                PlayerOwnershipStatus.OWNED
                if draft_team is not None
                else PlayerOwnershipStatus.AVAILABLE
            ),
            points=int(row["total_points"] or 0),
            form=float(row["form"] or 0),
            value=float(row["current_value"] or 0) / 10,
            selected_by_percent=float(row["selected_by_percent"] or 0),
            minutes=int(row["minutes"] or 0),
            goals_scored=int(row["goals_scored"] or 0),
            assists=int(row["assists"] or 0),
            clean_sheets=int(row["clean_sheets"] or 0),
            expected_goals=float(row["expected_goals"] or 0),
            expected_assists=float(row["expected_assists"] or 0),
            availability_status=row["availability_status"],
            availability_news=row["availability_news"] or "",
            chance_of_playing_next_round=row["chance_of_playing_next_round"],
            next_fixture=next_fixture,
        )

    def list_squad_players(self) -> list[PlayerDetail]:
        return [player for player in self._database_players() if player.draft_team is not None]

    def list_players(self, filters: ScoutingFilters) -> list[PlayerDetail]:
        players = self._database_players()
        if filters.position is not None:
            players = [player for player in players if player.position == filters.position]
        if filters.draft_team_id is not None:
            players = [
                player
                for player in players
                if player.draft_team is not None and player.draft_team.id == filters.draft_team_id
            ]
        if filters.epl_team_id is not None:
            players = [player for player in players if player.epl_team.id == filters.epl_team_id]
        if filters.query:
            query = filters.query.casefold()
            players = [player for player in players if query in player.display_name.casefold()]
        with self._session_factory() as session:
            interested_player_ids = set(
                session.execute(
                    select(squad_interests_table.c.player_id).where(
                        squad_interests_table.c.status == "active"
                    )
                ).scalars()
            )
        for player in players:
            if player.id in interested_player_ids and player.draft_team is None:
                player.status = PlayerOwnershipStatus.INTERESTED
        metric = "points" if filters.metric.value == "total_points" else filters.metric.value
        return sorted(players, key=lambda player: getattr(player, metric), reverse=True)

    def list_available_rights(self) -> list[PlayerDetail]:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            player_ids = list(
                session.execute(
                    select(player_rights_table.c.player_id)
                    .where(
                        player_rights_table.c.season_id == DEMO_SEASON_ID,
                        player_rights_table.c.draft_team_id == self.manager_team.id,
                        player_rights_table.c.released_at.is_(None),
                        (player_rights_table.c.expires_at.is_(None))
                        | (player_rights_table.c.expires_at > now),
                    )
                    .order_by(player_rights_table.c.acquired_at)
                ).scalars()
            )
        players = {player.id: player for player in self._database_players()}
        available = []
        for player_id in player_ids:
            player = players.get(str(player_id))
            if player is not None and player.draft_team is None:
                player.status = PlayerOwnershipStatus.AVAILABLE
                available.append(player)
        return available

    def apply_squad_changes(self, add_player_ids: list[str], remove_player_ids: list[str]) -> None:
        if len(add_player_ids) != len(remove_player_ids):
            raise ValueError("Each squad addition must replace one removed player.")
        if not add_player_ids:
            return
        now = datetime.now(UTC)
        with self._session_factory() as session:
            rights = list(
                session.execute(
                    select(player_rights_table).where(
                        player_rights_table.c.season_id == DEMO_SEASON_ID,
                        player_rights_table.c.draft_team_id == self.manager_team.id,
                        player_rights_table.c.player_id.in_(add_player_ids),
                        player_rights_table.c.released_at.is_(None),
                        (player_rights_table.c.expires_at.is_(None))
                        | (player_rights_table.c.expires_at > now),
                    )
                ).mappings()
            )
            if {str(row["player_id"]) for row in rights} != set(add_player_ids):
                raise ValueError("Every added player must have an active temporary right.")
            ownerships = list(
                session.execute(
                    select(squad_ownerships_table)
                    .where(
                        squad_ownerships_table.c.season_id == DEMO_SEASON_ID,
                        squad_ownerships_table.c.draft_team_id == self.manager_team.id,
                        squad_ownerships_table.c.player_id.in_(remove_player_ids),
                        squad_ownerships_table.c.ended_at.is_(None),
                    )
                    .order_by(squad_ownerships_table.c.started_at)
                ).mappings()
            )
            if {str(row["player_id"]) for row in ownerships} != set(remove_player_ids):
                raise ValueError("Every removed player must be in the active squad.")
            slots_by_player = {str(row["player_id"]): row["roster_slot_id"] for row in ownerships}
            for player_id in remove_player_ids:
                session.execute(
                    update(squad_ownerships_table)
                    .where(squad_ownerships_table.c.player_id == player_id)
                    .where(squad_ownerships_table.c.draft_team_id == self.manager_team.id)
                    .where(squad_ownerships_table.c.season_id == DEMO_SEASON_ID)
                    .where(squad_ownerships_table.c.ended_at.is_(None))
                    .values(ended_at=now)
                )
            for index, player_id in enumerate(add_player_ids):
                session.execute(
                    insert(squad_ownerships_table).values(
                        id=f"ownership-right-{uuid4().hex[:12]}",
                        season_id=DEMO_SEASON_ID,
                        draft_team_id=self.manager_team.id,
                        player_id=player_id,
                        roster_slot_id=slots_by_player[remove_player_ids[index]],
                        started_at=now,
                        ended_at=None,
                    )
                )
                session.execute(
                    update(player_rights_table)
                    .where(
                        player_rights_table.c.season_id == DEMO_SEASON_ID,
                        player_rights_table.c.draft_team_id == self.manager_team.id,
                        player_rights_table.c.player_id == player_id,
                        player_rights_table.c.released_at.is_(None),
                    )
                    .values(released_at=now)
                )
            session.commit()
        self._invalidate_players_cache()

    def get_player(self, player_id: str) -> PlayerDetail | None:
        return next(
            (player for player in self._database_players() if player.id == player_id),
            None,
        )

    def list_interests(self) -> list[InterestResponse]:
        with self._session_factory() as session:
            rows = list(
                session.execute(
                    select(
                        squad_interests_table.c.id,
                        squad_interests_table.c.player_id,
                        squad_interests_table.c.gameweek,
                        squad_interests_table.c.note,
                    )
                    .where(
                        squad_interests_table.c.manager_id == self._manager_id,
                        squad_interests_table.c.status == "active",
                    )
                    .order_by(squad_interests_table.c.created_at)
                ).mappings()
            )
        return [self._interest_from_row(row) for row in rows]

    def find_active_interest_by_player(self, player_id: str) -> InterestResponse | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(
                        squad_interests_table.c.id,
                        squad_interests_table.c.player_id,
                        squad_interests_table.c.gameweek,
                        squad_interests_table.c.note,
                    ).where(
                        squad_interests_table.c.manager_id == self._manager_id,
                        squad_interests_table.c.player_id == player_id,
                        squad_interests_table.c.status == "active",
                    )
                )
                .mappings()
                .first()
            )
        return None if row is None else self._interest_from_row(row)

    def _interest_from_row(self, row: object) -> InterestResponse:
        player = self.get_player(row["player_id"])
        if player is None:
            raise ValueError(f"Unknown interest player: {row['player_id']}")
        player.status = PlayerOwnershipStatus.INTERESTED
        gameweek_number = int(row["gameweek"])
        gameweek = self.gameweek.model_copy(
            update={
                "id": f"gw-{gameweek_number}",
                "name": f"Gameweek {gameweek_number}",
                "number": gameweek_number,
            }
        )
        return InterestResponse(
            id=row["id"],
            player=player,
            gameweek=gameweek,
            note=row["note"] or None,
        )

    def save_interest(self, interest: InterestResponse) -> InterestResponse:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            session.execute(
                insert(squad_interests_table).values(
                    id=interest.id,
                    season_id=DEMO_SEASON_ID,
                    draft_team_id=self.manager_team.id,
                    manager_id=self._manager_id,
                    player_id=interest.player.id,
                    gameweek=self.gameweek.number,
                    status="active",
                    note=interest.note or "",
                    created_at=now,
                    updated_at=now,
                )
            )
            session.commit()
        return interest

    def delete_interest(self, interest_id: str) -> bool:
        with self._session_factory() as session:
            result = session.execute(
                update(squad_interests_table)
                .where(squad_interests_table.c.id == interest_id)
                .values(status="deleted", updated_at=datetime.now(UTC))
            )
            session.commit()
        return result.rowcount > 0

    def list_trades(self) -> list[TradeProposal]:
        with self._session_factory() as session:
            trade_ids = list(
                session.execute(
                    select(trade_proposals_table.c.id).order_by(trade_proposals_table.c.created_at)
                ).scalars()
            )
        trades = [self._get_trade(trade_id) for trade_id in trade_ids]
        return [trade for trade in trades if trade is not None]

    def save_trade(self, trade: TradeProposal) -> TradeProposal:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            session.execute(
                insert(trade_proposals_table).values(
                    id=trade.id,
                    season_id=DEMO_SEASON_ID,
                    offered_by_team_id=trade.offered_by.id,
                    offered_to_team_id=trade.offered_to.id,
                    gameweek=self.gameweek.number,
                    status=trade.status.value,
                    created_at=now,
                    updated_at=now,
                )
            )
            for asset in trade.assets:
                session.execute(
                    insert(trade_assets_table).values(
                        id=f"trade-asset-{uuid4().hex[:8]}",
                        trade_id=trade.id,
                        player_id=asset.player.id,
                        from_team_id=asset.from_team.id,
                        to_team_id=asset.to_team.id,
                    )
                )
            session.commit()
        return trade

    def manager_id_for_team(self, team_id: str) -> str | None:
        with self._session_factory() as session:
            return session.execute(
                select(draft_teams_table.c.manager_id).where(draft_teams_table.c.id == team_id)
            ).scalar_one_or_none()

    def team_for_id(self, team_id: str) -> TeamSummary | None:
        if team_id == self.manager_team.id:
            return self.manager_team
        if team_id == self.rival_team.id:
            return self.rival_team
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(draft_teams_table.c.id, draft_teams_table.c.name).where(
                        draft_teams_table.c.id == team_id
                    )
                )
                .mappings()
                .first()
            )
        return None if row is None else TeamSummary(id=str(row["id"]), name=str(row["name"]))

    def update_trade_status(
        self,
        trade_id: str,
        status: TradeStatus,
    ) -> TradeProposal | None:
        with self._session_factory() as session:
            result = session.execute(
                update(trade_proposals_table)
                .where(
                    trade_proposals_table.c.id == trade_id,
                    trade_proposals_table.c.status == TradeStatus.PROPOSED.value,
                )
                .values(status=status.value, updated_at=datetime.now(UTC))
            )
            session.commit()
        if result.rowcount == 0:
            return self._get_trade(trade_id)
        return self._get_trade(trade_id)

    def _get_trade(self, trade_id: str) -> TradeProposal | None:
        with self._session_factory() as session:
            trade_row = (
                session.execute(
                    select(
                        trade_proposals_table.c.id,
                        trade_proposals_table.c.status,
                        trade_proposals_table.c.offered_by_team_id,
                        trade_proposals_table.c.offered_to_team_id,
                    ).where(trade_proposals_table.c.id == trade_id)
                )
                .mappings()
                .first()
            )
            asset_rows = list(
                session.execute(
                    select(
                        trade_assets_table.c.player_id,
                        trade_assets_table.c.from_team_id,
                        trade_assets_table.c.to_team_id,
                    ).where(trade_assets_table.c.trade_id == trade_id)
                ).mappings()
            )
        if trade_row is None:
            return None
        return TradeProposal(
            id=trade_row["id"],
            status=TradeStatus(trade_row["status"]),
            offered_by=self._team_for_id(trade_row["offered_by_team_id"]),
            offered_to=self._team_for_id(trade_row["offered_to_team_id"]),
            gameweek=self.gameweek,
            assets=[self._asset_from_row(row) for row in asset_rows],
        )

    def _asset_from_row(self, row: object) -> TradeAsset:
        player = self.get_player(row["player_id"])
        if player is None:
            raise ValueError(f"Unknown trade asset player: {row['player_id']}")
        return TradeAsset(
            player=player,
            from_team=self._team_for_id(row["from_team_id"]),
            to_team=self._team_for_id(row["to_team_id"]),
        )

    def _team_for_id(self, team_id: str) -> TeamSummary:
        if team_id == self.manager_team.id:
            return self.manager_team
        if team_id == self.rival_team.id:
            return self.rival_team
        return TeamSummary(id=team_id, name=team_id)
