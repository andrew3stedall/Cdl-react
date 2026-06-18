"""PostgreSQL table metadata for team selection and chip persistence."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, MetaData, String, Table

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

team_selection_chips_table = Table("team_selection_chips", metadata)
team_selection_fixture_locks_table = Table("team_selection_fixture_locks", metadata)
team_selection_audit_events_table = Table("team_selection_audit_events", metadata)

TEAM_SELECTION_PERSISTENCE_TABLES = (
    team_selection_lineup_slots_table,
    team_selection_chips_table,
    team_selection_fixture_locks_table,
    team_selection_audit_events_table,
)
