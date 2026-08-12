"""persist manager FDR colour scale preferences

Revision ID: 0012_fdr_colour_scale_preferences
Revises: 0011_pitch_attack_direction
Create Date: 2026-08-12 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012_fdr_colour_scale_preferences"
down_revision: str | None = "0011_pitch_attack_direction"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "fdr_scale",
            sa.String(length=64),
            nullable=False,
            server_default="RdYlGn",
        ),
    )
    op.add_column(
        "user_preferences",
        sa.Column(
            "fdr_scale_reversed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "fdr_scale_reversed")
    op.drop_column("user_preferences", "fdr_scale")
