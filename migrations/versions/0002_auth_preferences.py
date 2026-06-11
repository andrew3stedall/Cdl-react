"""create auth session and preference tables

Revision ID: 0002_auth_preferences
Revises: 0001_create_migration_probe
Create Date: 2026-06-10 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_auth_preferences"
down_revision: str | None = "0001_create_migration_probe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("roles", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=64),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
    )
    op.create_table(
        "user_preferences",
        sa.Column(
            "user_id",
            sa.String(length=64),
            sa.ForeignKey("users.id"),
            primary_key=True,
        ),
        sa.Column("theme_preset", sa.String(length=64), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("user_preferences")
    op.drop_table("sessions")
    op.drop_table("users")
