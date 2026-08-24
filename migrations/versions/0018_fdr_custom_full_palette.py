"""persist the second and fourth custom FDR colours

Revision ID: 0018_fdr_custom_full_palette
Revises: 0017_auth_passkeys
Create Date: 2026-08-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018_fdr_custom_full_palette"
down_revision: str | None = "0017_auth_passkeys"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column(
            "fdr_custom_second",
            sa.String(length=7),
            nullable=False,
            server_default="#8CAFD2",
        ),
    )
    op.add_column(
        "user_preferences",
        sa.Column(
            "fdr_custom_fourth",
            sa.String(length=7),
            nullable=False,
            server_default="#D58891",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "fdr_custom_fourth")
    op.drop_column("user_preferences", "fdr_custom_second")
