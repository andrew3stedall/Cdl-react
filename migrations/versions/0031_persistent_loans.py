"""Persist loan agreements, approvals, ownership movement, and return events."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0031_persistent_loans"
down_revision: str | None = "0030_movement_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "loans",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("season_id", sa.String(length=64), sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column(
            "player_id", sa.String(length=64), sa.ForeignKey("fpl_players.id"), nullable=False
        ),
        sa.Column(
            "lender_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False
        ),
        sa.Column(
            "borrower_team_id",
            sa.String(length=64),
            sa.ForeignKey("draft_teams.id"),
            nullable=False,
        ),
        sa.Column(
            "created_by_manager_id",
            sa.String(length=64),
            sa.ForeignKey("managers.id"),
            nullable=False,
        ),
        sa.Column(
            "agreed_by_manager_id",
            sa.String(length=64),
            sa.ForeignKey("managers.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("approval_status", sa.String(length=64), nullable=False),
        sa.Column("required_approver_role", sa.String(length=64), nullable=False),
        sa.Column(
            "approved_by_manager_id",
            sa.String(length=64),
            sa.ForeignKey("managers.id"),
            nullable=True,
        ),
        sa.Column("duration_gameweeks", sa.Integer(), nullable=False),
        sa.Column("start_gameweek", sa.Integer(), nullable=True),
        sa.Column("due_gameweek", sa.Integer(), nullable=True),
        sa.Column(
            "lender_roster_slot_id",
            sa.String(length=64),
            sa.ForeignKey("squad_roster_slots.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_loans_season_status_due", "loans", ["season_id", "status", "due_gameweek"])
    op.create_index("ix_loans_player_status", "loans", ["season_id", "player_id", "status"])
    op.create_table(
        "loan_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("loan_id", sa.String(length=64), sa.ForeignKey("loans.id"), nullable=False),
        sa.Column(
            "actor_manager_id", sa.String(length=64), sa.ForeignKey("managers.id"), nullable=True
        ),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )


def downgrade() -> None:
    op.drop_table("loan_events")
    op.drop_index("ix_loans_player_status", table_name="loans")
    op.drop_index("ix_loans_season_status_due", table_name="loans")
    op.drop_table("loans")
