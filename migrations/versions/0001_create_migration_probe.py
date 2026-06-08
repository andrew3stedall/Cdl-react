"""create migration probe table

Revision ID: 0001_create_migration_probe
Revises:
Create Date: 2026-06-08 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0001_create_migration_probe"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "migration_probe",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_by_revision", sa.String(length=64), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("migration_probe")
