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

from cdl_api.contracts.team_selection import (
    ChipState,
    ChipStatus,
    LineupPlayerUpdate,
    LineupSlot,
    TeamSelectionPlayer,
)
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository

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

DEMO_SEASON_ID = "season-2026"


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

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        super().__init__()
        self._session_factory = session_factory

    def get_players(self) -> list[TeamSelectionPlayer]:
        rows = self._lineup_rows()
        if not rows:
            return super().get_players()

        players_by_id = {player.id: player for player in super().get_players()}
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

    def save_lineup(
        self, updates: list[LineupPlayerUpdate]
    ) -> list[TeamSelectionPlayer]:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            session.execute(
                _remove_existing(team_selection_lineup_slots_table).where(
                    team_selection_lineup_slots_table.c.season_id == DEMO_SEASON_ID,
                    team_selection_lineup_slots_table.c.draft_team_id
                    == self.manager_team.id,
                    team_selection_lineup_slots_table.c.gameweek
                    == self.gameweek.number,
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
        return super().save_lineup(updates)

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
                            self.gameweek.number
                            if chip.status == ChipStatus.ACTIVE
                            else None
                        ),
                        used_gameweek=(
                            self.gameweek.number
                            if chip.status == ChipStatus.USED
                            else None
                        ),
                        updated_at=now,
                    )
                )
            session.commit()
        return super().save_chips(chips)

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
                    team_selection_lineup_slots_table.c.draft_team_id
                    == self.manager_team.id,
                    team_selection_lineup_slots_table.c.gameweek
                    == self.gameweek.number,
                )
                .order_by(
                    team_selection_lineup_slots_table.c.slot,
                    team_selection_lineup_slots_table.c.slot_order,
                )
            )
            return _mapping_rows(result)

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
