"""create squad transfer persistence tables

Revision ID: 0004_squad_transfer_persistence
Revises: 0003_core_league_fpl_cache
Create Date: 2026-06-13 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_squad_transfer_persistence"
down_revision: str | None = "0003_core_league_fpl_cache"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


ID = sa.String(length=64)
SHORT_TEXT = sa.String(length=64)
LONG_TEXT = sa.String(length=255)
NOTE_TEXT = sa.String(length=512)


def upgrade() -> None:
    op.create_table(
        "squad_roster_slots",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("draft_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("slot_key", SHORT_TEXT, nullable=False),
        sa.Column(
            "position_id",
            sa.String(length=16),
            sa.ForeignKey("fpl_positions.id"),
            nullable=True,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "squad_ownerships",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("draft_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("player_id", ID, sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("roster_slot_id", ID, sa.ForeignKey("squad_roster_slots.id"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "player_rights",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("draft_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("player_id", ID, sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("right_type", SHORT_TEXT, nullable=False),
        sa.Column("source_ref", LONG_TEXT, nullable=False, server_default=""),
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "draft_picks",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("original_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("owning_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("pick_number", sa.Integer(), nullable=True),
        sa.Column("status", SHORT_TEXT, nullable=False),
    )
    op.create_table(
        "squad_interests",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("draft_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("manager_id", ID, sa.ForeignKey("managers.id"), nullable=False),
        sa.Column("player_id", ID, sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("status", SHORT_TEXT, nullable=False),
        sa.Column("note", NOTE_TEXT, nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "free_agent_claims",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("draft_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("manager_id", ID, sa.ForeignKey("managers.id"), nullable=False),
        sa.Column("player_id", ID, sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("claim_priority", sa.Integer(), nullable=False),
        sa.Column("status", SHORT_TEXT, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "transfer_proposals",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("proposing_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("target_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=True),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("status", SHORT_TEXT, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "transfer_assets",
        sa.Column("id", ID, primary_key=True),
        sa.Column("proposal_id", ID, sa.ForeignKey("transfer_proposals.id"), nullable=False),
        sa.Column("player_id", ID, sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("direction", SHORT_TEXT, nullable=False),
        sa.Column("source_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=True),
        sa.Column("destination_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=True),
    )
    op.create_table(
        "trade_proposals",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("offered_by_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("offered_to_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("status", SHORT_TEXT, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "trade_assets",
        sa.Column("id", ID, primary_key=True),
        sa.Column("trade_id", ID, sa.ForeignKey("trade_proposals.id"), nullable=False),
        sa.Column("player_id", ID, sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("from_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("to_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
    )
    op.create_table(
        "trade_approvals",
        sa.Column("id", ID, primary_key=True),
        sa.Column("trade_id", ID, sa.ForeignKey("trade_proposals.id"), nullable=False),
        sa.Column("manager_id", ID, sa.ForeignKey("managers.id"), nullable=False),
        sa.Column("decision", SHORT_TEXT, nullable=False),
        sa.Column("note", NOTE_TEXT, nullable=False, server_default=""),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "squad_rejection_reasons",
        sa.Column("id", ID, primary_key=True),
        sa.Column("subject_type", SHORT_TEXT, nullable=False),
        sa.Column("subject_id", ID, nullable=False),
        sa.Column("code", SHORT_TEXT, nullable=False),
        sa.Column("message", NOTE_TEXT, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "squad_audit_events",
        sa.Column("id", ID, primary_key=True),
        sa.Column("subject_type", SHORT_TEXT, nullable=False),
        sa.Column("subject_id", ID, nullable=False),
        sa.Column("action", SHORT_TEXT, nullable=False),
        sa.Column("actor_manager_id", ID, sa.ForeignKey("managers.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )


def downgrade() -> None:
    op.drop_table("squad_audit_events")
    op.drop_table("squad_rejection_reasons")
    op.drop_table("trade_approvals")
    op.drop_table("trade_assets")
    op.drop_table("trade_proposals")
    op.drop_table("transfer_assets")
    op.drop_table("transfer_proposals")
    op.drop_table("free_agent_claims")
    op.drop_table("squad_interests")
    op.drop_table("draft_picks")
    op.drop_table("player_rights")
    op.drop_table("squad_ownerships")
    op.drop_table("squad_roster_slots")
