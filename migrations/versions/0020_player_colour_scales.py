"""persist player position and metric colour scale preferences

Revision ID: 0020_player_colour_scales
Revises: 0019_fdr_custom_palettes
Create Date: 2026-08-25 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020_player_colour_scales"
down_revision: str | None = "0019_fdr_custom_palettes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column("position_colour_scale", sa.String(length=32), nullable=False, server_default="Classic"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("metric_colour_scale", sa.String(length=32), nullable=False, server_default="Blue"),
    )
    op.add_column(
        "user_preferences",
        sa.Column("metric_colour_scale_reversed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "metric_colour_scale_reversed")
    op.drop_column("user_preferences", "metric_colour_scale")
    op.drop_column("user_preferences", "position_colour_scale")
