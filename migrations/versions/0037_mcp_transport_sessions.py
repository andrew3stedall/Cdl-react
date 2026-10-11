"""Persist Streamable HTTP MCP handshake sessions.

Revision ID: 0037_mcp_transport_sessions
Revises: 0036_mcp_oauth
"""

import sqlalchemy as sa
from alembic import op

revision = "0037_mcp_transport_sessions"
down_revision = "0036_mcp_oauth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mcp_transport_sessions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("connection_id", sa.String(length=64), nullable=False),
        sa.Column("protocol_version", sa.String(length=32), nullable=False),
        sa.Column("initialized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_mcp_transport_sessions_expiry", "mcp_transport_sessions", ["expires_at"])
    op.create_index(
        "ix_mcp_transport_sessions_connection", "mcp_transport_sessions", ["connection_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_mcp_transport_sessions_connection", table_name="mcp_transport_sessions")
    op.drop_index("ix_mcp_transport_sessions_expiry", table_name="mcp_transport_sessions")
    op.drop_table("mcp_transport_sessions")
