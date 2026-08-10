"""persist manager pitch attack direction preference

Revision ID: 0011_pitch_attack_direction
Revises: 0010_fpl_player_metrics
Create Date: 2026-08-10 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_pitch_attack_direction"
down_revision: str | None = "0010_fpl_player_metrics"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "attack_direction",
            sa.String(length=16),
            nullable=False,
            server_default="up",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "attack_direction")
