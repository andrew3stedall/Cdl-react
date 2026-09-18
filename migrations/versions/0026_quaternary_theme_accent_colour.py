"""persist quaternary theme accent colour

Revision ID: 0026_quaternary_theme_accent
Revises: 0025_theme_accent_colours
Create Date: 2026-09-18 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0026_quaternary_theme_accent"
down_revision: str | None = "0025_theme_accent_colours"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "quaternary_theme_colour",
            sa.String(length=7),
            nullable=False,
            server_default="#14B8A6",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "quaternary_theme_colour")
