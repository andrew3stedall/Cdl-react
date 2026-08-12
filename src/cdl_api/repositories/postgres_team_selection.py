"""PostgreSQL-backed team selection and chip persistence."""

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
from cdl_api.contracts.team_selection import (
    ChipState,
    ChipStatus,
    LineupPlayerUpdate,
    LineupSlot,
    TeamSelectionPlayer,
)
from cdl_api.repositories.postgres_fpl_data import fpl_gameweeks_table
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

        self.gameweek = GameweekSummary(
            id="gw-1",
            name="Gameweek 1",
            number=1,
            deadline_at=self._read_next_deadline() or self.gameweek.deadline_at,
        )

    def get_players(self) -> list[TeamSelectionPlayer]:
        players = self._database_roster()
        if not players:
            return []
        rows = self._lineup_rows()
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
                            self.gameweek.number if chip.status == ChipStatus.ACTIVE else None
                        ),
                        used_gameweek=(
                            self.gameweek.number if chip.status == ChipStatus.USED else None
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
                    team_selection_fixture_locks_table.c.gameweek == self.gameweek.number,
                )
                .order_by(team_selection_fixture_locks_table.c.locked_at.desc())
                .limit(1)
            )
            rows = _mapping_rows(result)
            if not rows:
                return None
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

    def _lineup_rows(self) -> list[Mapping[str, object]]:
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
                    team_selection_lineup_slots_table.c.gameweek == self.gameweek.number,
                )
                .order_by(
                    team_selection_lineup_slots_table.c.slot,
                    team_selection_lineup_slots_table.c.slot_order,
                )
            )
            return _mapping_rows(result)

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
