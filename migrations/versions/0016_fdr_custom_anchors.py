"""persist custom FDR scale anchors

Revision ID: 0016_fdr_custom_anchors
Revises: 0015_theme_colour_preferences
Create Date: 2026-08-23 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016_fdr_custom_anchors"
down_revision: str | None = "0015_theme_colour_preferences"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for name, colour in (
        ("fdr_custom_min", "#2166AC"),
        ("fdr_custom_mid", "#F7F7F7"),
        ("fdr_custom_max", "#B2182B"),
    ):
        op.add_column(
            "user_preferences",
            sa.Column(name, sa.String(length=7), nullable=False, server_default=colour),
        )


def downgrade() -> None:
    op.drop_column("user_preferences", "fdr_custom_max")
    op.drop_column("user_preferences", "fdr_custom_mid")
    op.drop_column("user_preferences", "fdr_custom_min")
