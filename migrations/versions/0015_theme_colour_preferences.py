"""persist user-selected light and dark theme colours

Revision ID: 0015_theme_colour_preferences
Revises: 0014_fpl_provisional_fixture
Create Date: 2026-08-23 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_theme_colour_preferences"
down_revision: str | None = "0014_fpl_provisional_fixture"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "light_theme_colour",
            sa.String(length=7),
            nullable=False,
            server_default="#0F766E",
        ),
    )
    op.add_column(
        "user_preferences",
        sa.Column(
            "dark_theme_colour",
            sa.String(length=7),
            nullable=False,
            server_default="#2DD4BF",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "dark_theme_colour")
    op.drop_column("user_preferences", "light_theme_colour")
