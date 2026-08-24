"""Add durable sessions and passkey authentication support.

Revision ID: 0017_auth_passkeys
Revises: 0016_fdr_custom_anchors
Create Date: 2026-08-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017_auth_passkeys"
down_revision: str | None = "0016_fdr_custom_anchors"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "sessions",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE sessions "
            "SET created_at = CURRENT_TIMESTAMP, "
            "expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days' "
            "WHERE created_at IS NULL OR expires_at IS NULL"
        )
    )
    op.alter_column("sessions", "created_at", nullable=False)
    op.alter_column("sessions", "expires_at", nullable=False)

    op.create_table(
        "passkey_credentials",
        sa.Column("credential_id", sa.String(length=512), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=64),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("public_key", sa.LargeBinary(), nullable=False),
        sa.Column("sign_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transports", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("nickname", sa.String(length=255), nullable=False, server_default="This device"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "auth_challenges",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("challenge", sa.LargeBinary(), nullable=False),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("auth_challenges")
    op.drop_table("passkey_credentials")
    op.drop_column("sessions", "expires_at")
    op.drop_column("sessions", "created_at")
