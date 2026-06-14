"""PostgreSQL table metadata for team selection and chip persistence."""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
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
