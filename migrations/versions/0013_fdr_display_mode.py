"""persist manager FDR display mode

Revision ID: 0013_fdr_display_mode
Revises: 0012_fdr_scale_prefs
Create Date: 2026-08-12 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_fdr_display_mode"
down_revision: str | None = "0012_fdr_scale_prefs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "fdr_display_mode",
            sa.String(length=16),
            nullable=False,
            server_default="font",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "fdr_display_mode")
