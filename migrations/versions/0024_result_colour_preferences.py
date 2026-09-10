"""persist semantic win draw loss colour preferences

Revision ID: 0024_result_colour_preferences
Revises: 0023_lineup_substitutions
Create Date: 2026-09-11 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0024_result_colour_preferences"
down_revision: str | None = "0023_lineup_substitutions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "result_win_colour", sa.String(length=7), nullable=False, server_default="#22C55E"
        ),
    )
    op.add_column(
        "user_preferences",
        sa.Column(
            "result_draw_colour", sa.String(length=7), nullable=False, server_default="#F59E0B"
        ),
    )
    op.add_column(
        "user_preferences",
        sa.Column(
            "result_loss_colour", sa.String(length=7), nullable=False, server_default="#F43F5E"
        ),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "result_loss_colour")
    op.drop_column("user_preferences", "result_draw_colour")
    op.drop_column("user_preferences", "result_win_colour")
