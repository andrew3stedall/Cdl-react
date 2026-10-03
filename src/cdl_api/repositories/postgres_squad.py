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
    UniqueConstraint,
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
    Column("approval_status", String(64), nullable=False, server_default="not_submitted"),
    Column("required_approver_role", String(64), nullable=True),
    Column("approved_by_manager_id", String(64), ForeignKey("managers.id"), nullable=True),
    Column("executed_at", DateTime(timezone=True), nullable=True),
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

free_agency_draws_table = Table(
    "free_agency_draws",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("status", String(64), nullable=False),
    Column("opens_at", DateTime(timezone=True), nullable=True),
    Column("closes_at", DateTime(timezone=True), nullable=False),
    Column("processed_at", DateTime(timezone=True), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    UniqueConstraint("season_id", "gameweek", name="uq_free_agency_draw_season_gameweek"),
)

free_agency_draw_order_table = Table(
    "free_agency_draw_order",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("draw_id", String(64), ForeignKey("free_agency_draws.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("position", Integer(), nullable=False),
    UniqueConstraint("draw_id", "draft_team_id", name="uq_free_agency_draw_order_team"),
    UniqueConstraint("draw_id", "position", name="uq_free_agency_draw_order_position"),
)

free_agency_preferences_table = Table(
    "free_agency_preferences",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("draw_id", String(64), ForeignKey("free_agency_draws.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("manager_id", String(64), ForeignKey("managers.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("rank", Integer(), nullable=False),
    Column("submitted_at", DateTime(timezone=True), nullable=False),
    UniqueConstraint("draw_id", "draft_team_id", "rank", name="uq_free_agency_preference_rank"),
    UniqueConstraint(
        "draw_id", "draft_team_id", "player_id", name="uq_free_agency_preference_player"
    ),
)

free_agency_results_table = Table(
    "free_agency_results",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("draw_id", String(64), ForeignKey("free_agency_draws.id"), nullable=False),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=True),
    Column("preference_rank", Integer(), nullable=True),
    Column("reason_code", String(64), nullable=False),
    Column("temporary_right_id", String(64), ForeignKey("player_rights.id"), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    UniqueConstraint("draw_id", "draft_team_id", name="uq_free_agency_result_team"),
    UniqueConstraint("draw_id", "player_id", name="uq_free_agency_result_player"),
)

free_agency_events_table = Table(
    "free_agency_events",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("draw_id", String(64), ForeignKey("free_agency_draws.id"), nullable=False),
    Column("actor_manager_id", String(64), ForeignKey("managers.id"), nullable=True),
    Column("action", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("metadata_json", JSON(), nullable=False, server_default=text("'{}'")),
)

loans_table = Table(
    "loans",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("lender_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("borrower_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("created_by_manager_id", String(64), ForeignKey("managers.id"), nullable=False),
    Column("agreed_by_manager_id", String(64), ForeignKey("managers.id"), nullable=True),
    Column("status", String(64), nullable=False),
    Column("approval_status", String(64), nullable=False),
    Column("required_approver_role", String(64), nullable=False),
    Column("approved_by_manager_id", String(64), ForeignKey("managers.id"), nullable=True),
    Column("duration_gameweeks", Integer(), nullable=False),
    Column("start_gameweek", Integer(), nullable=True),
    Column("due_gameweek", Integer(), nullable=True),
    Column("lender_roster_slot_id", String(64), ForeignKey("squad_roster_slots.id"), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("approved_at", DateTime(timezone=True), nullable=True),
    Column("returned_at", DateTime(timezone=True), nullable=True),
)

loan_events_table = Table(
    "loan_events",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("loan_id", String(64), ForeignKey("loans.id"), nullable=False),
    Column("actor_manager_id", String(64), ForeignKey("managers.id"), nullable=True),
    Column("action", String(64), nullable=False),
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
    free_agency_draws_table,
    free_agency_draw_order_table,
    free_agency_preferences_table,
    free_agency_results_table,
    free_agency_events_table,
    loans_table,
    loan_events_table,
)
