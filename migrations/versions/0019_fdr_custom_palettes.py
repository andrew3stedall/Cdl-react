"""persist manager-owned FDR custom palettes

Revision ID: 0019_fdr_custom_palettes
Revises: 0018_fdr_custom_full_palette
Create Date: 2026-08-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019_fdr_custom_palettes"
down_revision: str | None = "0018_fdr_custom_full_palette"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "fdr_custom_palettes",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("fdr_custom_min", sa.String(length=7), nullable=False),
        sa.Column("fdr_custom_second", sa.String(length=7), nullable=False),
        sa.Column("fdr_custom_mid", sa.String(length=7), nullable=False),
        sa.Column("fdr_custom_fourth", sa.String(length=7), nullable=False),
        sa.Column("fdr_custom_max", sa.String(length=7), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fdr_custom_palettes_user_id", "fdr_custom_palettes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_fdr_custom_palettes_user_id", table_name="fdr_custom_palettes")
    op.drop_table("fdr_custom_palettes")
