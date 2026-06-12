"""PostgreSQL table metadata for squad transfer and trade state."""

from sqlalchemy import Column, ForeignKey, Integer, JSON, MetaData, String, Table

metadata = MetaData()

squad_player_rights_table = Table(
    "squad_player_rights",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("acquired_gameweek", Integer(), nullable=False),
)

squad_roster_slots_table = Table(
    "squad_roster_slots",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("right_id", String(64), ForeignKey("squad_player_rights.id"), nullable=False),
    Column("slot", String(32), nullable=False),
)

draft_picks_table = Table(
    "draft_picks",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("round", Integer(), nullable=False),
    Column("pick_number", Integer(), nullable=False),
)

squad_interests_table = Table(
    "squad_interests",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("note", String(512), nullable=False),
)

free_agent_claims_table = Table(
    "free_agent_claims",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("priority", Integer(), nullable=False),
    Column("status", String(32), nullable=False),
)

transfer_proposals_table = Table(
    "transfer_proposals",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("player_in_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("player_out_id", String(64), ForeignKey("fpl_players.id"), nullable=True),
    Column("status", String(32), nullable=False),
    Column("rejection_reason", String(512), nullable=False),
)

trade_proposals_table = Table(
    "trade_proposals",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("offered_by_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("offered_to_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("status", String(32), nullable=False),
    Column("rejection_reason", String(512), nullable=False),
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
    Column("status", String(32), nullable=False),
)

squad_audit_events_table = Table(
    "squad_audit_events",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("draft_team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("event_type", String(64), nullable=False),
    Column("payload", JSON(), nullable=False),
)

SQUAD_STATE_TABLES = (
    squad_player_rights_table,
    squad_roster_slots_table,
    draft_picks_table,
    squad_interests_table,
    free_agent_claims_table,
    transfer_proposals_table,
    trade_proposals_table,
    trade_assets_table,
    trade_approvals_table,
    squad_audit_events_table,
)
