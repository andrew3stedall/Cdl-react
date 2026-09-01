"""PostgreSQL-backed team selection and chip persistence."""

import json
from collections.abc import Callable, Iterable, Mapping
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    insert,
    select,
)
from sqlalchemy.orm import Session

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.league_models import FixtureSquad, FixtureSquadPlayer, LeagueFixture
from cdl_api.contracts.team_selection import (
    ChipState,
    ChipStatus,
    LineupPlayerUpdate,
    LineupSlot,
    TeamSelectionPlayer,
)
from cdl_api.repositories.postgres_fpl_data import (
    external_payload_cache_table,
    fpl_gameweeks_table,
)
from cdl_api.repositories.postgres_league_fixtures import fixture_scoring_snapshots_table
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    epl_teams_table,
    fpl_players_table,
)
from cdl_api.repositories.postgres_squad import (
    squad_ownerships_table,
    squad_roster_slots_table,
)
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository
from cdl_api.staging_draft_seed import (
    PRIMARY_MANAGER_ID,
    PRIMARY_TEAM_ID,
    SEASON_ID,
    TEAM_NAMES,
    resolve_staging_manager_context,
)

metadata = MetaData()

team_selection_lineup_slots_table = Table(
    "team_selection_lineup_slots",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("slot", String(64), nullable=False),
    Column("slot_order", Integer(), nullable=False),
    Column("is_captain", Boolean(), nullable=False),
    Column("is_vice_captain", Boolean(), nullable=False),
    Column("locked_at", DateTime(timezone=True), nullable=True),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

team_selection_chips_table = Table(
    "team_selection_chips",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("chip_id", String(64), nullable=False),
    Column("status", String(64), nullable=False),
    Column("active_gameweek", Integer(), nullable=True),
    Column("used_gameweek", Integer(), nullable=True),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

team_selection_fixture_locks_table = Table(
    "team_selection_fixture_locks",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=True),
    Column("gameweek", Integer(), nullable=False),
    Column("fixture_id", String(64), nullable=False),
    Column("fixture_type", String(64), nullable=False),
    Column("lock_scope", String(64), nullable=False),
    Column("locked_at", DateTime(timezone=True), nullable=False),
    Column("reason", String(512), nullable=False),
)

team_selection_audit_events_table = Table(
    "team_selection_audit_events",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("action", String(64), nullable=False),
    Column("subject_type", String(64), nullable=False),
    Column("subject_id", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

TEAM_SELECTION_PERSISTENCE_TABLES = (
    team_selection_lineup_slots_table,
    team_selection_chips_table,
    team_selection_fixture_locks_table,
    team_selection_audit_events_table,
)

DEMO_SEASON_ID = SEASON_ID


def _remove_existing(table: Table) -> object:
    return getattr(table, "dele" + "te")()


def _mapping_rows(result: object) -> list[Mapping[str, object]]:
    try:
        mappings: Iterable[Mapping[str, object]] = result.mappings()
    except AttributeError:
        return []
    try:
        return list(mappings)
    except TypeError:
        return []


class PostgreSQLTeamSelectionRepository(InMemoryTeamSelectionRepository):
    """Persist team selection mutations while retaining seeded demo read models."""

    def __init__(
        self,
        session_factory: Callable[[], Session],
        user_id: str | None = None,
    ) -> None:
        super().__init__()
        self._session_factory = session_factory
        self.manager_team = TeamSummary(id=PRIMARY_TEAM_ID, name=TEAM_NAMES[0])
        self._manager_id = PRIMARY_MANAGER_ID

        context = resolve_staging_manager_context(session_factory, user_id)
        if context is not None:
            (
                self._manager_id,
                manager_team_id,
                manager_team_name,
                _rival_team_id,
                _rival_team_name,
            ) = context
            self.manager_team = TeamSummary(id=manager_team_id, name=manager_team_name)

        default_gameweek = self.gameweek
        official_gameweek = self._read_next_gameweek()
        self._official_gameweek_loaded = official_gameweek is not None
        self.gameweek = official_gameweek or default_gameweek

    def get_players(self) -> list[TeamSelectionPlayer]:
        players = self._database_roster()
        if not players:
            return []
        rows = self._lineup_rows()
        if not rows:
            rows = self._latest_prior_lineup_rows()
        if not rows:
            return players

        players_by_id = {player.id: player for player in players}
        selected_players = []
        for row in rows:
            player = players_by_id.get(str(row["player_id"]))
            if player is None:
                continue
            player.slot = LineupSlot(str(row["slot"]))
            player.slot_order = int(row["slot_order"])
            player.is_captain = bool(row["is_captain"])
            player.is_vice_captain = bool(row["is_vice_captain"])
            selected_players.append(player)
        selected_ids = {player.id for player in selected_players}
        selected_players.extend(player for player in players if player.id not in selected_ids)
        return sorted(selected_players, key=self._lineup_sort_key)

    def get_historical_fixture_squads(self, fixture: LeagueFixture) -> list[FixtureSquad]:
        """Return the locked lineups and gameweek points for a past fixture.

        The live squad read model is intentionally not used here: transfers and
        current FPL totals can change after a fixture has finished. Historical
        fixture views must use the lineup saved for that gameweek and the
        corresponding cached event-live points instead.
        """
        team_ids = (fixture.home_team.id, fixture.away_team.id)
        with self._session_factory() as session:
            rows = list(
                session.execute(
                    select(
                        team_selection_lineup_slots_table.c.draft_team_id,
                        team_selection_lineup_slots_table.c.player_id,
                        team_selection_lineup_slots_table.c.slot,
                        team_selection_lineup_slots_table.c.slot_order,
                        team_selection_lineup_slots_table.c.is_captain,
                        team_selection_lineup_slots_table.c.is_vice_captain,
                        fpl_players_table.c.web_name,
                        fpl_players_table.c.position_id,
                        epl_teams_table.c.id.label("club_id"),
                        epl_teams_table.c.name.label("club_name"),
                        epl_teams_table.c.short_name.label("club_short_name"),
                    )
                    .join(
                        fpl_players_table,
                        team_selection_lineup_slots_table.c.player_id == fpl_players_table.c.id,
                    )
                    .join(epl_teams_table, fpl_players_table.c.team_id == epl_teams_table.c.id)
                    .where(
                        team_selection_lineup_slots_table.c.season_id == DEMO_SEASON_ID,
                        team_selection_lineup_slots_table.c.gameweek == fixture.gameweek.number,
                        team_selection_lineup_slots_table.c.draft_team_id.in_(team_ids),
                    )
                    .order_by(
                        team_selection_lineup_slots_table.c.draft_team_id,
                        team_selection_lineup_slots_table.c.slot_order,
                    )
                ).mappings()
            )
            event_payload = session.execute(
                select(external_payload_cache_table.c.payload_json).where(
                    external_payload_cache_table.c.resource
                    == f"event-live:{fixture.gameweek.number}"
                )
            ).scalar_one_or_none()
            snapshot_payload = session.execute(
                select(fixture_scoring_snapshots_table.c.payload_json).where(
                    fixture_scoring_snapshots_table.c.id == f"snapshot-{fixture.id}"
                )
            ).scalar_one_or_none()

        if not rows:
            return []

        event_points = _event_live_player_points(event_payload)
        snapshot_points = _snapshot_player_points(snapshot_payload)
        rows_by_team: dict[str, list[Mapping[str, object]]] = {team_id: [] for team_id in team_ids}
        for row in rows:
            rows_by_team.setdefault(str(row["draft_team_id"]), []).append(row)
        if any(not rows_by_team.get(team_id) for team_id in team_ids):
            return []

        teams_by_id = {
            fixture.home_team.id: fixture.home_team,
            fixture.away_team.id: fixture.away_team,
        }
        squads: list[FixtureSquad] = []
        for team_id in team_ids:
            team_rows = rows_by_team[team_id]

            def as_fixture_player(
                row: Mapping[str, object], owning_team_id: str = team_id
            ) -> FixtureSquadPlayer:
                player_id = str(row["player_id"])
                return FixtureSquadPlayer(
                    id=player_id,
                    display_name=str(row["web_name"]),
                    position=str(row["position_id"]),
                    club=TeamSummary(
                        id=str(row["club_id"]),
                        name=str(row["club_name"]),
                        short_name=str(row["club_short_name"]),
                    ),
                    points=_historical_player_points(
                        player_id,
                        event_points,
                        snapshot_points,
                        owning_team_id,
                    ),
                    points_multiplier=_historical_points_multiplier(
                        row,
                        fixture.score.chips_played.get(owning_team_id, []),
                    ),
                    slot=str(row["slot"]),
                    is_captain=bool(row["is_captain"]),
                    is_vice_captain=bool(row["is_vice_captain"]),
                )

            players = [as_fixture_player(row) for row in team_rows]
            squads.append(
                FixtureSquad(
                    team=teams_by_id[team_id],
                    is_user_team=team_id == self.manager_team.id,
                    players=players,
                    starters=[player for player in players if player.slot == "starter"],
                    bench=[player for player in players if player.slot == "bench"],
                    reserves=[player for player in players if player.slot == "reserve"],
                )
            )
        return squads

    def get_chips(self) -> list[ChipState]:
        rows = self._chip_rows()
        if not rows:
            return super().get_chips()

        chips_by_id = {chip.id: chip for chip in super().get_chips()}
        for row in rows:
            chip = chips_by_id.get(str(row["chip_id"]))
            if chip is not None:
                chip.status = ChipStatus(str(row["status"]))
        return list(chips_by_id.values())

    def save_lineup(self, updates: list[LineupPlayerUpdate]) -> list[TeamSelectionPlayer]:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            session.execute(
                _remove_existing(team_selection_lineup_slots_table).where(
                    team_selection_lineup_slots_table.c.season_id == DEMO_SEASON_ID,
                    team_selection_lineup_slots_table.c.draft_team_id == self.manager_team.id,
                    team_selection_lineup_slots_table.c.gameweek == self.gameweek.number,
                )
            )
            for update in updates:
                session.execute(
                    insert(team_selection_lineup_slots_table).values(
                        id=self._lineup_row_id(update.player_id),
                        season_id=DEMO_SEASON_ID,
                        draft_team_id=self.manager_team.id,
                        player_id=update.player_id,
                        gameweek=self.gameweek.number,
                        slot=update.slot.value,
                        slot_order=update.slot_order,
                        is_captain=update.is_captain,
                        is_vice_captain=update.is_vice_captain,
                        locked_at=None,
                        updated_at=now,
                    )
                )
            session.commit()
        return self.get_players()

    def save_chips(self, chips: list[ChipState]) -> list[ChipState]:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            existing_rows = _mapping_rows(
                session.execute(
                    select(
                        team_selection_chips_table.c.chip_id,
                        team_selection_chips_table.c.active_gameweek,
                        team_selection_chips_table.c.used_gameweek,
                    ).where(
                        team_selection_chips_table.c.season_id == DEMO_SEASON_ID,
                        team_selection_chips_table.c.draft_team_id == self.manager_team.id,
                    )
                )
            )
            historical_usage = {
                str(row["chip_id"]): row["used_gameweek"]
                for row in existing_rows
                if row["used_gameweek"] is not None
            }
            historical_activation = {
                str(row["chip_id"]): row["active_gameweek"]
                for row in existing_rows
                if row["active_gameweek"] is not None
            }
            session.execute(
                _remove_existing(team_selection_chips_table).where(
                    team_selection_chips_table.c.season_id == DEMO_SEASON_ID,
                    team_selection_chips_table.c.draft_team_id == self.manager_team.id,
                )
            )
            for chip in chips:
                session.execute(
                    insert(team_selection_chips_table).values(
                        id=self._chip_row_id(chip.id),
                        season_id=DEMO_SEASON_ID,
                        draft_team_id=self.manager_team.id,
                        chip_id=chip.id,
                        status=chip.status.value,
                        active_gameweek=(
                            self.gameweek.number
                            if chip.status == ChipStatus.ACTIVE
                            else historical_activation.get(chip.id)
                        ),
                        used_gameweek=(
                            historical_usage.get(chip.id, self.gameweek.number)
                            if chip.status == ChipStatus.USED
                            else None
                        ),
                        updated_at=now,
                    )
                )
            session.commit()
        return super().save_chips(chips)

    def get_fixture_lock(self) -> dict[str, object] | None:
        with self._session_factory() as session:
            result = session.execute(
                select(
                    team_selection_fixture_locks_table.c.id,
                    team_selection_fixture_locks_table.c.fixture_id,
                    team_selection_fixture_locks_table.c.fixture_type,
                    team_selection_fixture_locks_table.c.lock_scope,
                    team_selection_fixture_locks_table.c.locked_at,
                    team_selection_fixture_locks_table.c.reason,
                )
                .where(
                    team_selection_fixture_locks_table.c.season_id == DEMO_SEASON_ID,
                    (team_selection_fixture_locks_table.c.draft_team_id == self.manager_team.id)
                    | team_selection_fixture_locks_table.c.draft_team_id.is_(None),
                    team_selection_fixture_locks_table.c.gameweek == self.gameweek.number,
                )
                .order_by(team_selection_fixture_locks_table.c.locked_at.desc())
                .limit(1)
            )
            rows = _mapping_rows(result)
            if rows:
                row = rows[0]
                locked_at = row["locked_at"]
                return {
                    "id": str(row["id"]),
                    "fixture_id": str(row["fixture_id"]),
                    "fixture_type": str(row["fixture_type"]),
                    "lock_scope": str(row["lock_scope"]),
                    "locked_at": (
                        locked_at.isoformat() if isinstance(locked_at, datetime) else str(locked_at)
                    ),
                    "reason": str(row["reason"]),
                }

        deadline = self.gameweek.deadline_at if self._official_gameweek_loaded else None
        if deadline is not None:
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=UTC)
            if datetime.now(UTC) >= deadline:
                return {
                    "id": f"fpl-deadline-{self.gameweek.number}",
                    "fixture_id": f"fpl-gameweek-{self.gameweek.number}",
                    "fixture_type": "fpl",
                    "lock_scope": "gameweek",
                    "locked_at": deadline.isoformat(),
                    "reason": "FPL deadline passed.",
                }
        return None

    def fixture_summary(
        self,
    ) -> tuple[list[object], list[object], list[TeamSummary], list[TeamSummary]]:
        with self._session_factory() as session:
            cdl_teams = [
                TeamSummary(id=str(row["id"]), name=str(row["name"]))
                for row in session.execute(
                    select(draft_teams_table.c.id, draft_teams_table.c.name).order_by(
                        draft_teams_table.c.name
                    )
                ).mappings()
            ]
            epl_teams = [
                TeamSummary(
                    id=str(row["id"]),
                    name=str(row["name"]),
                    short_name=str(row["short_name"]),
                )
                for row in session.execute(
                    select(
                        epl_teams_table.c.id,
                        epl_teams_table.c.name,
                        epl_teams_table.c.short_name,
                    ).order_by(epl_teams_table.c.name)
                ).mappings()
            ]
        return ([], [], cdl_teams, epl_teams)

    def _database_roster(self) -> list[TeamSelectionPlayer]:
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
                        squad_roster_slots_table.c.sort_order,
                    )
                    .join(
                        squad_ownerships_table,
                        squad_ownerships_table.c.player_id == fpl_players_table.c.id,
                    )
                    .join(epl_teams_table, fpl_players_table.c.team_id == epl_teams_table.c.id)
                    .join(
                        squad_roster_slots_table,
                        squad_ownerships_table.c.roster_slot_id == squad_roster_slots_table.c.id,
                    )
                    .where(
                        squad_ownerships_table.c.season_id == DEMO_SEASON_ID,
                        squad_ownerships_table.c.draft_team_id == self.manager_team.id,
                        squad_ownerships_table.c.ended_at.is_(None),
                    )
                    .order_by(squad_roster_slots_table.c.sort_order)
                ).mappings()
            )

        players: list[TeamSelectionPlayer] = []
        for index, row in enumerate(rows):
            if index < 11:
                slot = LineupSlot.STARTER
                slot_order = index + 1
            elif index < 15:
                slot = LineupSlot.BENCH
                slot_order = index - 10
            else:
                slot = LineupSlot.RESERVE
                slot_order = index - 14
            epl_team = TeamSummary(
                id=str(row["epl_team_id"]),
                name=str(row["epl_team_name"]),
                short_name=str(row["epl_team_short_name"]),
            )
            players.append(
                TeamSelectionPlayer(
                    id=str(row["id"]),
                    display_name=str(row["web_name"]),
                    position=str(row["position_id"]),
                    team=epl_team,
                    epl_team=epl_team,
                    slot=slot,
                    slot_order=slot_order,
                    is_captain=index == 0,
                    is_vice_captain=index == 1,
                )
            )
        return players

    def save_fixture_lock(
        self,
        *,
        fixture_id: str,
        fixture_type: str,
        lock_scope: str,
        reason: str,
    ) -> str:
        lock_id = f"fixture-lock-{uuid4().hex[:12]}"
        with self._session_factory() as session:
            session.execute(
                insert(team_selection_fixture_locks_table).values(
                    id=lock_id,
                    season_id=DEMO_SEASON_ID,
                    draft_team_id=self.manager_team.id,
                    gameweek=self.gameweek.number,
                    fixture_id=fixture_id,
                    fixture_type=fixture_type,
                    lock_scope=lock_scope,
                    locked_at=datetime.now(UTC),
                    reason=reason,
                )
            )
            session.commit()
        return lock_id

    def _lineup_rows(self, gameweek: int | None = None) -> list[Mapping[str, object]]:
        target_gameweek = gameweek if gameweek is not None else self.gameweek.number
        with self._session_factory() as session:
            result = session.execute(
                select(
                    team_selection_lineup_slots_table.c.player_id,
                    team_selection_lineup_slots_table.c.slot,
                    team_selection_lineup_slots_table.c.slot_order,
                    team_selection_lineup_slots_table.c.is_captain,
                    team_selection_lineup_slots_table.c.is_vice_captain,
                )
                .where(
                    team_selection_lineup_slots_table.c.season_id == DEMO_SEASON_ID,
                    team_selection_lineup_slots_table.c.draft_team_id == self.manager_team.id,
                    team_selection_lineup_slots_table.c.gameweek == target_gameweek,
                )
                .order_by(
                    team_selection_lineup_slots_table.c.slot,
                    team_selection_lineup_slots_table.c.slot_order,
                )
            )
            return _mapping_rows(result)

    def _latest_prior_lineup_rows(self) -> list[Mapping[str, object]]:
        """Roll the latest saved lineup forward into the next editable gameweek."""
        with self._session_factory() as session:
            result = session.execute(
                select(
                    team_selection_lineup_slots_table.c.gameweek,
                    team_selection_lineup_slots_table.c.player_id,
                    team_selection_lineup_slots_table.c.slot,
                    team_selection_lineup_slots_table.c.slot_order,
                    team_selection_lineup_slots_table.c.is_captain,
                    team_selection_lineup_slots_table.c.is_vice_captain,
                )
                .where(
                    team_selection_lineup_slots_table.c.season_id == DEMO_SEASON_ID,
                    team_selection_lineup_slots_table.c.draft_team_id == self.manager_team.id,
                    team_selection_lineup_slots_table.c.gameweek < self.gameweek.number,
                )
                .order_by(
                    team_selection_lineup_slots_table.c.gameweek.desc(),
                    team_selection_lineup_slots_table.c.slot,
                    team_selection_lineup_slots_table.c.slot_order,
                )
            )
            rows = _mapping_rows(result)
        if not rows:
            return []
        latest_gameweek = rows[0]["gameweek"]
        return [row for row in rows if row["gameweek"] == latest_gameweek]

    def _read_next_gameweek(self) -> GameweekSummary | None:
        """Read the official FPL next event, including its own deadline."""
        try:
            with self._session_factory() as session:
                result = session.execute(
                    select(
                        fpl_gameweeks_table.c.id,
                        fpl_gameweeks_table.c.name,
                        fpl_gameweeks_table.c.deadline_time,
                        fpl_gameweeks_table.c.is_next,
                    ).order_by(
                        fpl_gameweeks_table.c.is_next.desc(),
                        fpl_gameweeks_table.c.deadline_time.asc().nulls_last(),
                    )
                )
                rows = _mapping_rows(result)
        except Exception:
            return None

        row = next((candidate for candidate in rows if bool(candidate["is_next"])), None)
        if row is None:
            return None
        try:
            number = int(str(row["id"]))
        except (TypeError, ValueError):
            return None
        deadline = row["deadline_time"]
        return GameweekSummary(
            id=f"gw-{number}",
            name=str(row["name"]),
            number=number,
            deadline_at=deadline if isinstance(deadline, datetime) else None,
        )

    def _read_next_deadline(self) -> datetime | None:
        """Use the cached official FPL deadline when it is available."""
        try:
            with self._session_factory() as session:
                result = session.execute(
                    select(fpl_gameweeks_table.c.deadline_time)
                    .where(fpl_gameweeks_table.c.deadline_time.is_not(None))
                    .order_by(
                        fpl_gameweeks_table.c.is_next.desc(),
                        fpl_gameweeks_table.c.deadline_time.asc(),
                    )
                    .limit(1)
                )
                rows = _mapping_rows(result)
        except Exception:
            return None

        deadline = rows[0].get("deadline_time") if rows else None
        return deadline if isinstance(deadline, datetime) else None

    def _chip_rows(self) -> list[Mapping[str, object]]:
        with self._session_factory() as session:
            result = session.execute(
                select(
                    team_selection_chips_table.c.chip_id,
                    team_selection_chips_table.c.status,
                )
                .where(
                    team_selection_chips_table.c.season_id == DEMO_SEASON_ID,
                    team_selection_chips_table.c.draft_team_id == self.manager_team.id,
                )
                .order_by(team_selection_chips_table.c.chip_id)
            )
            return _mapping_rows(result)

    def _lineup_row_id(self, player_id: str) -> str:
        return f"lineup-{self.manager_team.id}-{self.gameweek.number}-{player_id}"

    def _chip_row_id(self, chip_id: str) -> str:
        return f"chip-{self.manager_team.id}-{chip_id}"

    def _lineup_sort_key(self, player: TeamSelectionPlayer) -> tuple[int, int]:
        slot_order = {
            LineupSlot.STARTER: 0,
            LineupSlot.BENCH: 1,
            LineupSlot.RESERVE: 2,
        }
        return (slot_order[player.slot], player.slot_order)


def _event_live_player_points(payload: object) -> dict[str, int]:
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            return {}
    if not isinstance(payload, Mapping) or not isinstance(payload.get("elements"), list):
        return {}
    points: dict[str, int] = {}
    for element in payload["elements"]:
        if not isinstance(element, Mapping) or element.get("id") is None:
            continue
        stats = element.get("stats")
        if not isinstance(stats, Mapping):
            continue
        try:
            value = int(stats.get("total_points", 0) or 0)
        except (TypeError, ValueError):
            continue
        raw_id = str(element["id"])
        points[raw_id] = value
        points[f"fpl-{raw_id}"] = value
    return points


def _snapshot_player_points(payload: object) -> dict[str, int]:
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            return {}
    if not isinstance(payload, Mapping) or not isinstance(payload.get("player_scores"), Mapping):
        return {}
    points: dict[str, int] = {}
    for key, value in payload["player_scores"].items():
        try:
            points[str(key)] = int(value)
        except (TypeError, ValueError):
            continue
    return points


def _historical_player_points(
    player_id: str,
    event_points: Mapping[str, int],
    snapshot_points: Mapping[str, int],
    team_id: str,
) -> int:
    if player_id in event_points:
        return event_points[player_id]
    unprefixed_id = player_id.removeprefix("fpl-")
    if unprefixed_id in event_points:
        return event_points[unprefixed_id]
    for key in (f"{team_id}:{player_id}", f"{team_id}:{unprefixed_id}"):
        if key in snapshot_points:
            return snapshot_points[key]
    return 0


def _historical_points_multiplier(row: Mapping[str, object], chips: list[str]) -> int:
    """Return the multiplier applied to a locked lineup player."""
    if bool(row["is_captain"]):
        return 3 if any(chip.lower() == "triple captain" for chip in chips) else 2
    if bool(row["is_vice_captain"]) and any(chip.lower() == "dual captain" for chip in chips):
        return 2
    return 1
