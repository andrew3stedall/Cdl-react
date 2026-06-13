"""PostgreSQL table metadata for squad, transfer, and trade persistence."""

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    text,
)

metadata = MetaData()

squad_roster_slots_table = Table(
    "squad_roster_slots",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("slot_key", String(64), nullable=False),
    Column("position_id", String(16), ForeignKey("fpl_positions.id"), nullable=True),
    Column("sort_order", Integer(), nullable=False),
    Column("is_required", Boolean(), nullable=False),
)

squad_ownerships_table = Table(
    "squad_ownerships",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("roster_slot_id", String(64), ForeignKey("squad_roster_slots.id"), nullable=True),
    Column("started_at", DateTime(timezone=True), nullable=False),
    Column("ended_at", DateTime(timezone=True), nullable=True),
)

player_rights_table = Table(
    "player_rights",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("right_type", String(64), nullable=False),
    Column("source_ref", String(255), nullable=False),
    Column("acquired_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=True),
    Column("released_at", DateTime(timezone=True), nullable=True),
)

draft_picks_table = Table(
    "draft_picks",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("original_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("owning_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("round_number", Integer(), nullable=False),
    Column("pick_number", Integer(), nullable=True),
    Column("status", String(64), nullable=False),
)

squad_interests_table = Table(
    "squad_interests",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("manager_id", String(64), ForeignKey("managers.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("status", String(64), nullable=False),
    Column("note", String(512), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

free_agent_claims_table = Table(
    "free_agent_claims",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("manager_id", String(64), ForeignKey("managers.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("claim_priority", Integer(), nullable=False),
    Column("status", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("resolved_at", DateTime(timezone=True), nullable=True),
)

transfer_proposals_table = Table(
    "transfer_proposals",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("proposing_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("target_team_id", String(64), ForeignKey("draft_teams.id"), nullable=True),
    Column("gameweek", Integer(), nullable=False),
    Column("status", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

transfer_assets_table = Table(
    "transfer_assets",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("proposal_id", String(64), ForeignKey("transfer_proposals.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("direction", String(64), nullable=False),
    Column("source_team_id", String(64), ForeignKey("draft_teams.id"), nullable=True),
    Column("destination_team_id", String(64), ForeignKey("draft_teams.id"), nullable=True),
)

trade_proposals_table = Table(
    "trade_proposals",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("offered_by_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("offered_to_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("status", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

trade_assets_table = Table(
    "trade_assets",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("trade_id", String(64), ForeignKey("trade_proposals.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("from_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("to_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
)

trade_approvals_table = Table(
    "trade_approvals",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("trade_id", String(64), ForeignKey("trade_proposals.id"), nullable=False),
    Column("manager_id", String(64), ForeignKey("managers.id"), nullable=False),
    Column("decision", String(64), nullable=False),
    Column("note", String(512), nullable=False),
    Column("decided_at", DateTime(timezone=True), nullable=False),
)

squad_rejection_reasons_table = Table(
    "squad_rejection_reasons",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("subject_type", String(64), nullable=False),
    Column("subject_id", String(64), nullable=False),
    Column("code", String(64), nullable=False),
    Column("message", String(512), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

squad_audit_events_table = Table(
    "squad_audit_events",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("subject_type", String(64), nullable=False),
    Column("subject_id", String(64), nullable=False),
    Column("action", String(64), nullable=False),
    Column("actor_manager_id", String(64), ForeignKey("managers.id"), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("metadata_json", JSON(), nullable=False, server_default=text("'{}'")),
)

SQUAD_PERSISTENCE_TABLES = (
    squad_roster_slots_table,
    squad_ownerships_table,
    player_rights_table,
    draft_picks_table,
    squad_interests_table,
    free_agent_claims_table,
    transfer_proposals_table,
    transfer_assets_table,
    trade_proposals_table,
    trade_assets_table,
    trade_approvals_table,
    squad_rejection_reasons_table,
    squad_audit_events_table,
)
