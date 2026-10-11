"""Persist AI execution grants, exact action approvals, and routine activity.

Revision ID: 0038_ai_execution_controls
Revises: 0037_mcp_transport_sessions
"""

import sqlalchemy as sa
from alembic import op

revision = "0038_ai_execution_controls"
down_revision = "0037_mcp_transport_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_execution_grants",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("connection_id", sa.String(length=64), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
    )
    op.create_index(
        "ix_ai_grant_active_lookup",
        "ai_execution_grants",
        ["user_id", "connection_id", "expires_at"],
    )
    op.create_table(
        "ai_approval_proposals",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("connection_id", sa.String(length=64), nullable=False),
        sa.Column("tool_name", sa.String(length=120), nullable=False),
        sa.Column("arguments", sa.JSON(), nullable=False),
        sa.Column("action_digest", sa.String(length=64), nullable=False),
        sa.Column("state_version", sa.String(length=128), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("rejected_at", sa.DateTime(timezone=True)),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.UniqueConstraint(
            "user_id",
            "connection_id",
            "tool_name",
            "idempotency_key",
            name="uq_ai_approval_actor_connection_tool_idempotency",
        ),
    )
    op.create_index("ix_ai_approval_expiry", "ai_approval_proposals", ["expires_at", "status"])
    op.create_table(
        "ai_activity_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("connection_id", sa.String(length=64), nullable=False),
        sa.Column("tool_name", sa.String(length=120), nullable=False),
        sa.Column("risk", sa.String(length=32), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("retention_until", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_activity_user_created", "ai_activity_events", ["user_id", "created_at"])
    op.create_index("ix_ai_activity_retention", "ai_activity_events", ["retention_until"])


def downgrade() -> None:
    op.drop_index("ix_ai_activity_retention", table_name="ai_activity_events")
    op.drop_index("ix_ai_activity_user_created", table_name="ai_activity_events")
    op.drop_table("ai_activity_events")
    op.drop_index("ix_ai_approval_expiry", table_name="ai_approval_proposals")
    op.drop_table("ai_approval_proposals")
    op.drop_index("ix_ai_grant_active_lookup", table_name="ai_execution_grants")
    op.drop_table("ai_execution_grants")
