"""persist player position and metric custom colour palettes

Revision ID: 0021_player_custom_colour_palettes
Revises: 0020_player_colour_scales
Create Date: 2026-08-25 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021_player_custom_colour_palettes"
down_revision: str | None = "0020_player_colour_scales"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "position_colour_mode", sa.String(length=32), nullable=False, server_default="name-font"
        ),
    )
    for name, default in {
        "position_custom_gkp": "#7C3AED",
        "position_custom_def": "#2563EB",
        "position_custom_mid": "#059669",
        "position_custom_fwd": "#EA580C",
        "metric_custom_1": "#2563EB",
        "metric_custom_2": "#0EA5A4",
        "metric_custom_3": "#A3C635",
        "metric_custom_4": "#F59E0B",
        "metric_custom_5": "#DC2626",
    }.items():
        op.add_column(
            "user_preferences",
            sa.Column(name, sa.String(length=7), nullable=False, server_default=default),
        )

    op.create_table(
        "player_colour_palettes",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("family", sa.String(length=16), nullable=False),
        sa.Column("colours", sa.JSON(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_player_colour_palettes_user_id", "player_colour_palettes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_player_colour_palettes_user_id", table_name="player_colour_palettes")
    op.drop_table("player_colour_palettes")
    for name in (
        "metric_custom_5",
        "metric_custom_4",
        "metric_custom_3",
        "metric_custom_2",
        "metric_custom_1",
        "position_custom_fwd",
        "position_custom_mid",
        "position_custom_def",
        "position_custom_gkp",
        "position_colour_mode",
    ):
        op.drop_column("user_preferences", name)
