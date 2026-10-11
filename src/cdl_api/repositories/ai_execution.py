"""Persistence for manually activated AI grants, exact approvals and routine audit."""

from collections.abc import Callable
from datetime import datetime
from typing import Any
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy import JSON, Column, DateTime, MetaData, String, Table, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

metadata = MetaData()
execution_grants = Table(
    "ai_execution_grants",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("user_id", String(64), nullable=False),
    Column("connection_id", String(64), nullable=False),
    Column("activated_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("revoked_at", DateTime(timezone=True)),
)
approval_proposals = Table(
    "ai_approval_proposals",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("user_id", String(64), nullable=False),
    Column("connection_id", String(64), nullable=False),
    Column("tool_name", String(120), nullable=False),
    Column("arguments", JSON, nullable=False),
    Column("action_digest", String(64), nullable=False),
    Column("state_version", String(128), nullable=False),
    Column("idempotency_key", String(128), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("approved_at", DateTime(timezone=True)),
    Column("rejected_at", DateTime(timezone=True)),
    Column("consumed_at", DateTime(timezone=True)),
    Column("status", String(20), nullable=False),
    Column("result", JSON),
)
activity_events = Table(
    "ai_activity_events",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("user_id", String(64), nullable=False),
    Column("connection_id", String(64), nullable=False),
    Column("tool_name", String(120), nullable=False),
    Column("risk", String(32), nullable=False),
    Column("outcome", String(32), nullable=False),
    Column("details", JSON, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("retention_until", DateTime(timezone=True), nullable=False),
)
sa.Index(
    "uq_ai_approval_actor_connection_tool_idempotency",
    approval_proposals.c.user_id,
    approval_proposals.c.connection_id,
    approval_proposals.c.tool_name,
    approval_proposals.c.idempotency_key,
    unique=True,
)


class InMemoryAIExecutionRepository:
    """Shared process-local repository for development and isolated tests."""

    def __init__(self) -> None:
        self.grants: dict[str, dict[str, Any]] = {}
        self.proposals: dict[str, dict[str, Any]] = {}
        self.events: list[dict[str, Any]] = []

    def activate(
        self, user_id: str, connection_id: str, now: datetime, expires_at: datetime
    ) -> str:
        grant_id = uuid4().hex
        self.grants[grant_id] = {
            "id": grant_id,
            "user_id": user_id,
            "connection_id": connection_id,
            "activated_at": now,
            "expires_at": expires_at,
            "revoked_at": None,
        }
        return grant_id

    def active_grant(
        self, user_id: str, connection_id: str, now: datetime
    ) -> dict[str, Any] | None:
        rows = [
            g
            for g in self.grants.values()
            if g["user_id"] == user_id
            and g["connection_id"] == connection_id
            and g["revoked_at"] is None
            and g["expires_at"] > now
        ]
        return dict(max(rows, key=lambda g: g["activated_at"])) if rows else None

    def revoke_grants(self, user_id: str, connection_id: str, now: datetime) -> int:
        rows = [
            g
            for g in self.grants.values()
            if g["user_id"] == user_id
            and g["connection_id"] == connection_id
            and g["revoked_at"] is None
        ]
        for row in rows:
            row["revoked_at"] = now
        return len(rows)

    def create_proposal(self, row: dict[str, Any]) -> dict[str, Any]:
        self.proposals[row["id"]] = dict(row)
        return dict(row)

    def get_proposal(self, proposal_id: str) -> dict[str, Any] | None:
        row = self.proposals.get(proposal_id)
        return dict(row) if row else None

    def update_proposal(self, proposal_id: str, **values: Any) -> bool:  # noqa: ANN401
        row = self.proposals.get(proposal_id)
        if not row:
            return False
        row.update(values)
        return True

    def find_proposal(
        self, user_id: str, connection_id: str, tool_name: str, idempotency_key: str
    ) -> dict[str, Any] | None:
        row = next(
            (
                p
                for p in self.proposals.values()
                if p["user_id"] == user_id
                and p["connection_id"] == connection_id
                and p["tool_name"] == tool_name
                and p["idempotency_key"] == idempotency_key
            ),
            None,
        )
        return dict(row) if row else None

    def approve_proposal(self, proposal_id: str, user_id: str, now: datetime) -> bool:
        row = self.proposals.get(proposal_id)
        if (
            not row
            or row["user_id"] != user_id
            or row["status"] != "pending"
            or row["expires_at"] <= now
        ):
            return False
        row.update(status="approved", approved_at=now)
        return True

    def reject_proposal(self, proposal_id: str, user_id: str, now: datetime) -> bool:
        row = self.proposals.get(proposal_id)
        if (
            not row
            or row["user_id"] != user_id
            or row["status"] != "pending"
            or row["expires_at"] <= now
        ):
            return False
        row.update(status="rejected", rejected_at=now)
        return True

    def consume_proposal(
        self, proposal_id: str, action_digest: str, now: datetime
    ) -> dict[str, Any] | None:
        row = self.proposals.get(proposal_id)
        if (
            not row
            or row["action_digest"] != action_digest
            or row["status"] != "approved"
            or row["consumed_at"]
            or row["expires_at"] <= now
        ):
            return None
        row.update(status="consumed", consumed_at=now)
        return dict(row)

    def append_activity(self, row: dict[str, Any]) -> None:
        self.events.append(dict(row))

    def list_activity(self, user_id: str, now: datetime, limit: int) -> list[dict[str, Any]]:
        self.events[:] = [row for row in self.events if row["retention_until"] > now]
        return [dict(row) for row in reversed(self.events) if row["user_id"] == user_id][:limit]


class PostgreSQLAIExecutionRepository:
    """Persistent, conditional updates for production-like protected environments."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def activate(
        self, user_id: str, connection_id: str, now: datetime, expires_at: datetime
    ) -> str:
        grant_id = uuid4().hex
        with self._session_factory() as session:
            session.execute(
                sa.insert(execution_grants).values(
                    id=grant_id,
                    user_id=user_id,
                    connection_id=connection_id,
                    activated_at=now,
                    expires_at=expires_at,
                    revoked_at=None,
                )
            )
            session.commit()
        return grant_id

    def active_grant(
        self, user_id: str, connection_id: str, now: datetime
    ) -> dict[str, Any] | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(execution_grants)
                    .where(
                        execution_grants.c.user_id == user_id,
                        execution_grants.c.connection_id == connection_id,
                        execution_grants.c.revoked_at.is_(None),
                        execution_grants.c.expires_at > now,
                    )
                    .order_by(execution_grants.c.activated_at.desc())
                    .limit(1)
                )
                .mappings()
                .first()
            )
        return dict(row) if row else None

    def revoke_grants(self, user_id: str, connection_id: str, now: datetime) -> int:
        with self._session_factory() as session:
            result = session.execute(
                sa.update(execution_grants)
                .where(
                    execution_grants.c.user_id == user_id,
                    execution_grants.c.connection_id == connection_id,
                    execution_grants.c.revoked_at.is_(None),
                )
                .values(revoked_at=now)
            )
            session.commit()
        return int(result.rowcount or 0)

    def create_proposal(self, row: dict[str, Any]) -> dict[str, Any]:
        with self._session_factory() as session:
            try:
                session.execute(sa.insert(approval_proposals).values(**row))
                session.commit()
                return dict(row)
            except IntegrityError:
                # Concurrent retries can race between find_proposal and insert.
                # Resolve the unique-key winner and let the policy compare its
                # digest/state instead of leaking a database exception.
                session.rollback()
                existing = (
                    session.execute(
                        select(approval_proposals).where(
                            approval_proposals.c.user_id == row["user_id"],
                            approval_proposals.c.connection_id == row["connection_id"],
                            approval_proposals.c.tool_name == row["tool_name"],
                            approval_proposals.c.idempotency_key == row["idempotency_key"],
                        )
                    )
                    .mappings()
                    .first()
                )
                if existing is None:
                    raise
                return dict(existing)

    def get_proposal(self, proposal_id: str) -> dict[str, Any] | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(approval_proposals).where(
                        approval_proposals.c.id == proposal_id,
                    )
                )
                .mappings()
                .first()
            )
        return dict(row) if row else None

    def update_proposal(self, proposal_id: str, **values: Any) -> bool:  # noqa: ANN401
        with self._session_factory() as session:
            result = session.execute(
                sa.update(approval_proposals)
                .where(
                    approval_proposals.c.id == proposal_id,
                )
                .values(**values)
            )
            session.commit()
        return bool(result.rowcount)

    def find_proposal(
        self, user_id: str, connection_id: str, tool_name: str, idempotency_key: str
    ) -> dict[str, Any] | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(approval_proposals).where(
                        approval_proposals.c.user_id == user_id,
                        approval_proposals.c.connection_id == connection_id,
                        approval_proposals.c.tool_name == tool_name,
                        approval_proposals.c.idempotency_key == idempotency_key,
                    )
                )
                .mappings()
                .first()
            )
        return dict(row) if row else None

    def approve_proposal(self, proposal_id: str, user_id: str, now: datetime) -> bool:
        with self._session_factory() as session:
            result = session.execute(
                sa.update(approval_proposals)
                .where(
                    approval_proposals.c.id == proposal_id,
                    approval_proposals.c.user_id == user_id,
                    approval_proposals.c.status == "pending",
                    approval_proposals.c.expires_at > now,
                )
                .values(status="approved", approved_at=now)
            )
            session.commit()
        return bool(result.rowcount)

    def reject_proposal(self, proposal_id: str, user_id: str, now: datetime) -> bool:
        with self._session_factory() as session:
            result = session.execute(
                sa.update(approval_proposals)
                .where(
                    approval_proposals.c.id == proposal_id,
                    approval_proposals.c.user_id == user_id,
                    approval_proposals.c.status == "pending",
                    approval_proposals.c.expires_at > now,
                )
                .values(status="rejected", rejected_at=now)
            )
            session.commit()
        return bool(result.rowcount)

    def consume_proposal(
        self, proposal_id: str, action_digest: str, now: datetime
    ) -> dict[str, Any] | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    sa.update(approval_proposals)
                    .where(
                        approval_proposals.c.id == proposal_id,
                        approval_proposals.c.action_digest == action_digest,
                        approval_proposals.c.status == "approved",
                        approval_proposals.c.consumed_at.is_(None),
                        approval_proposals.c.expires_at > now,
                    )
                    .values(status="consumed", consumed_at=now)
                    .returning(*approval_proposals.c)
                )
                .mappings()
                .first()
            )
            session.commit()
        return dict(row) if row else None

    def append_activity(self, row: dict[str, Any]) -> None:
        with self._session_factory() as session:
            session.execute(sa.insert(activity_events).values(**row))
            session.commit()

    def list_activity(self, user_id: str, now: datetime, limit: int) -> list[dict[str, Any]]:
        with self._session_factory() as session:
            session.execute(
                sa.delete(activity_events).where(activity_events.c.retention_until <= now)
            )
            rows = (
                session.execute(
                    select(activity_events)
                    .where(
                        activity_events.c.user_id == user_id,
                        activity_events.c.retention_until > now,
                    )
                    .order_by(activity_events.c.created_at.desc())
                    .limit(limit)
                )
                .mappings()
                .all()
            )
            session.commit()
        return [dict(row) for row in rows]


_memory_repository = InMemoryAIExecutionRepository()


def build_ai_execution_repository(
    repository_mode: str, session_factory: Callable[[], Session] | None = None
) -> InMemoryAIExecutionRepository | PostgreSQLAIExecutionRepository:
    if repository_mode == "postgres":
        if session_factory is None:
            raise ValueError("PostgreSQL AI execution persistence requires a session factory.")
        return PostgreSQLAIExecutionRepository(session_factory)
    return _memory_repository
