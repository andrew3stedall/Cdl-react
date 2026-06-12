"""create squad transfer and trade state tables

Revision ID: 0004_squad_transfer_trade_state
Revises: 0003_core_league_fpl_cache
Create Date: 2026-06-12 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_squad_transfer_trade_state"
down_revision: str | None = "0003_core_league_fpl_cache"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "squad_player_rights",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("draft_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("player_id", sa.String(length=64), sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("acquired_gameweek", sa.Integer(), nullable=False),
    )
    op.create_table(
        "squad_roster_slots",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("right_id", sa.String(length=64), sa.ForeignKey("squad_player_rights.id"), nullable=False),
        sa.Column("slot", sa.String(length=32), nullable=False),
    )
    op.create_table(
        "draft_picks",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("draft_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("season_id", sa.String(length=64), sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("pick_number", sa.Integer(), nullable=False),
    )
    op.create_table(
        "squad_interests",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("draft_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("player_id", sa.String(length=64), sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("note", sa.String(length=512), nullable=False, server_default=""),
    )
    op.create_table(
        "free_agent_claims",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("draft_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("player_id", sa.String(length=64), sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
    )
    op.create_table(
        "transfer_proposals",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("draft_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("player_in_id", sa.String(length=64), sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("player_out_id", sa.String(length=64), sa.ForeignKey("fpl_players.id"), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("rejection_reason", sa.String(length=512), nullable=False, server_default=""),
    )
    op.create_table(
        "trade_proposals",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("offered_by_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("offered_to_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("rejection_reason", sa.String(length=512), nullable=False, server_default=""),
    )
    op.create_table(
        "trade_assets",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("trade_id", sa.String(length=64), sa.ForeignKey("trade_proposals.id"), nullable=False),
        sa.Column("player_id", sa.String(length=64), sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("from_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("to_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False),
    )
    op.create_table(
        "trade_approvals",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("trade_id", sa.String(length=64), sa.ForeignKey("trade_proposals.id"), nullable=False),
        sa.Column("manager_id", sa.String(length=64), sa.ForeignKey("managers.id"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
    )
    op.create_table(
        "squad_audit_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("draft_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_table("squad_audit_events")
    op.drop_table("trade_approvals")
    op.drop_table("trade_assets")
    op.drop_table("trade_proposals")
    op.drop_table("transfer_proposals")
    op.drop_table("free_agent_claims")
    op.drop_table("squad_interests")
    op.drop_table("draft_picks")
    op.drop_table("squad_roster_slots")
    op.drop_table("squad_player_rights")
