"""add current official FPL player metrics

Revision ID: 0010_fpl_player_metrics
Revises: 0009_fpl_ingestion
Create Date: 2026-08-09 04:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_fpl_player_metrics"
down_revision: str | None = "0009_fpl_ingestion"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "fpl_player_current_metrics",
        sa.Column(
            "player_id",
            sa.String(length=64),
            sa.ForeignKey("fpl_players.id"),
            primary_key=True,
        ),
        sa.Column("total_points", sa.Integer(), nullable=False),
        sa.Column("form", sa.Float(), nullable=False),
        sa.Column("selected_by_percent", sa.Float(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("goals_scored", sa.Integer(), nullable=False),
        sa.Column("assists", sa.Integer(), nullable=False),
        sa.Column("clean_sheets", sa.Integer(), nullable=False),
        sa.Column("expected_goals", sa.Float(), nullable=False),
        sa.Column("expected_assists", sa.Float(), nullable=False),
        sa.Column("chance_of_playing_next_round", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("fpl_player_current_metrics")
