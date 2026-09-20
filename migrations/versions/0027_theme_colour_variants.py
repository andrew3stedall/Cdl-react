"""persist light and dark companion theme accent palettes

Revision ID: 0027_theme_colour_variants
Revises: 0026_quaternary_theme_accent
Create Date: 2026-09-20 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0027_theme_colour_variants"
down_revision: str | None = "0026_quaternary_theme_accent"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column("theme_colour_variants", sa.JSON(), nullable=True),
    )
    op.execute(
        sa.text(
            """
            UPDATE user_preferences
            SET theme_colour_variants = json_build_object(
                'light', json_build_object(
                    'primary', light_theme_colour,
                    'secondary', secondary_theme_colour,
                    'tertiary', tertiary_theme_colour,
                    'quaternary', quaternary_theme_colour
                ),
                'dark', json_build_object(
                    'primary', dark_theme_colour,
                    'secondary', secondary_theme_colour,
                    'tertiary', tertiary_theme_colour,
                    'quaternary', quaternary_theme_colour
                )
            )
            """
        )
    )
    op.alter_column("user_preferences", "theme_colour_variants", nullable=False)


def downgrade() -> None:
    op.drop_column("user_preferences", "theme_colour_variants")
