"""persist primary, secondary, and tertiary theme accent colours

Revision ID: 0025_theme_accent_colour_preferences
Revises: 0024_result_colour_preferences
Create Date: 2026-09-16 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0025_theme_accent_colour_preferences"
down_revision: str | None = "0024_result_colour_preferences"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for name, default in {
        "primary_theme_colour": "#0F766E",
        "secondary_theme_colour": "#115E59",
        "tertiary_theme_colour": "#0D9488",
    }.items():
        op.add_column(
            "user_preferences",
            sa.Column(name, sa.String(length=7), nullable=False, server_default=default),
        )


def downgrade() -> None:
    for name in ("tertiary_theme_colour", "secondary_theme_colour", "primary_theme_colour"):
        op.drop_column("user_preferences", name)
