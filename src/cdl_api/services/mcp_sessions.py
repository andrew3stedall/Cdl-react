"""Short-lived MCP protocol session state for Streamable HTTP clients."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy import Column, MetaData, String, Table, select
from sqlalchemy.orm import Session

metadata = MetaData()
mcp_sessions = Table(
    "mcp_transport_sessions",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("connection_id", String(64), nullable=False),
    Column("protocol_version", String(32), nullable=False),
    Column("initialized_at", sa.DateTime(timezone=True)),
    Column("expires_at", sa.DateTime(timezone=True), nullable=False),
)


class InMemoryMCPSessionStore:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}

    def create(self, connection_id: str, version: str) -> str:
        session_id = uuid4().hex
        self.rows[session_id] = {
            "connection_id": connection_id,
            "protocol_version": version,
            "initialized_at": None,
            "expires_at": datetime.now(UTC) + timedelta(hours=24),
        }
        return session_id

    def get(self, session_id: str) -> dict[str, Any] | None:
        row = self.rows.get(session_id)
        if row and row["expires_at"] > datetime.now(UTC):
            return dict(row)
        self.rows.pop(session_id, None)
        return None

    def initialize(self, session_id: str) -> None:
        self.rows[session_id]["initialized_at"] = datetime.now(UTC)


class PostgreSQLMCPSessionStore:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.session_factory = session_factory

    def create(self, connection_id: str, version: str) -> str:
        session_id = uuid4().hex
        with self.session_factory() as session:
            session.execute(
                sa.insert(mcp_sessions).values(
                    id=session_id,
                    connection_id=connection_id,
                    protocol_version=version,
                    initialized_at=None,
                    expires_at=datetime.now(UTC) + timedelta(hours=24),
                )
            )
            session.commit()
        return session_id

    def get(self, session_id: str) -> dict[str, Any] | None:
        with self.session_factory() as session:
            row = (
                session.execute(
                    select(mcp_sessions).where(
                        mcp_sessions.c.id == session_id,
                        mcp_sessions.c.expires_at > datetime.now(UTC),
                    )
                )
                .mappings()
                .first()
            )
        return dict(row) if row else None

    def initialize(self, session_id: str) -> None:
        with self.session_factory() as session:
            session.execute(
                sa.update(mcp_sessions)
                .where(
                    mcp_sessions.c.id == session_id,
                    mcp_sessions.c.expires_at > datetime.now(UTC),
                )
                .values(initialized_at=datetime.now(UTC))
            )
            session.commit()


_memory_store = InMemoryMCPSessionStore()


def get_mcp_session_store(
    repository_mode: str, session_factory: Callable[[], Session] | None = None
) -> InMemoryMCPSessionStore | PostgreSQLMCPSessionStore:
    if repository_mode == "postgres":
        if session_factory is None:
            raise ValueError("PostgreSQL MCP sessions require a session factory.")
        return PostgreSQLMCPSessionStore(session_factory)
    return _memory_store
