"""Storage for OAuth public clients, one-time codes, connections and refresh rotation."""

import hashlib
import hmac
import threading
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy import JSON, Column, MetaData, String, Table, select
from sqlalchemy.orm import Session

metadata = MetaData()
oauth_clients = Table(
    "oauth_clients",
    metadata,
    Column("client_id", String(64), primary_key=True),
    Column("client_name", String(120), nullable=False),
    Column("redirect_uris", JSON, nullable=False),
    Column("created_at", sa.DateTime(timezone=True), nullable=False),
)
oauth_codes = Table(
    "oauth_authorization_codes",
    metadata,
    Column("code_hash", String(64), primary_key=True),
    Column("client_id", String(64), nullable=False),
    Column("user_id", String(64), nullable=False),
    Column("redirect_uri", String(2048), nullable=False),
    Column("scopes", JSON, nullable=False),
    Column("code_challenge", String(128), nullable=False),
    Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    Column("consumed_at", sa.DateTime(timezone=True)),
)
oauth_connections = Table(
    "oauth_connections",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("user_id", String(64), nullable=False),
    Column("client_id", String(64), nullable=False),
    Column("scopes", JSON, nullable=False),
    Column("created_at", sa.DateTime(timezone=True), nullable=False),
    Column("last_used_at", sa.DateTime(timezone=True)),
    Column("revoked_at", sa.DateTime(timezone=True)),
)
oauth_refresh_tokens = Table(
    "oauth_refresh_tokens",
    metadata,
    Column("token_hash", String(64), primary_key=True),
    Column("connection_id", String(64), nullable=False),
    Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    Column("used_at", sa.DateTime(timezone=True)),
    Column("revoked_at", sa.DateTime(timezone=True)),
)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class OAuthStoreError(ValueError):
    """A client, code or token cannot be used for the requested operation."""


class InMemoryOAuthRepository:
    """Thread-safe test and development store; protected deployments use PostgreSQL."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._clients: dict[str, dict[str, Any]] = {}
        self._codes: dict[str, dict[str, Any]] = {}
        self._connections: dict[str, dict[str, Any]] = {}
        self._refresh: dict[str, dict[str, Any]] = {}

    def register_client(self, name: str, redirect_uris: list[str]) -> dict[str, Any]:
        row = {
            "client_id": f"cdl_{uuid4().hex}",
            "client_name": name,
            "redirect_uris": redirect_uris,
            "created_at": datetime.now(UTC),
        }
        with self._lock:
            self._clients[row["client_id"]] = row
        return row

    def get_client(self, client_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._clients.get(client_id)
            return dict(row) if row else None

    def create_code(self, code: str, row: dict[str, Any]) -> None:
        with self._lock:
            self._codes[token_hash(code)] = dict(row)

    def consume_code(
        self, code: str, client_id: str, redirect_uri: str, expected_challenge: str
    ) -> dict[str, Any] | None:
        now = datetime.now(UTC)
        with self._lock:
            row = self._codes.get(token_hash(code))
            if (
                not row
                or row["consumed_at"]
                or row["expires_at"] <= now
                or row["client_id"] != client_id
                or row["redirect_uri"] != redirect_uri
                or not hmac.compare_digest(row["code_challenge"], expected_challenge)
            ):
                return None
            row["consumed_at"] = now
            return dict(row)

    def create_connection(
        self, row: dict[str, Any], refresh_hash: str, refresh_expires: datetime
    ) -> dict[str, Any]:
        with self._lock:
            connection = dict(row)
            self._connections[connection["id"]] = connection
            self._refresh[refresh_hash] = {
                "connection_id": connection["id"],
                "expires_at": refresh_expires,
                "used_at": None,
                "revoked_at": None,
            }
            return dict(connection)

    def rotate_refresh(
        self, old_hash: str, new_hash: str, new_expires: datetime, client_id: str
    ) -> dict[str, Any] | None:
        now = datetime.now(UTC)
        with self._lock:
            token = self._refresh.get(old_hash)
            if token is None:
                return None
            connection = self._connections.get(token["connection_id"])
            if not connection or connection["client_id"] != client_id:
                return None
            if token["used_at"] is not None:
                if connection:
                    connection["revoked_at"] = now
                for entry in self._refresh.values():
                    if entry["connection_id"] == token["connection_id"]:
                        entry["revoked_at"] = now
                return None
            if (
                token["revoked_at"]
                or token["expires_at"] <= now
                or not connection
                or connection["revoked_at"]
            ):
                return None
            token["used_at"] = now
            self._refresh[new_hash] = {
                "connection_id": connection["id"],
                "expires_at": new_expires,
                "used_at": None,
                "revoked_at": None,
            }
            connection["last_used_at"] = now
            return dict(connection)

    def get_connection(self, connection_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connections.get(connection_id)
            return dict(row) if row else None

    def list_connections(self, user_id: str) -> list[dict[str, Any]]:
        with self._lock:
            return [
                {**row, "client_name": self._clients[row["client_id"]]["client_name"]}
                for row in self._connections.values()
                if row["user_id"] == user_id and row["revoked_at"] is None
            ]

    def revoke_connection(self, connection_id: str, user_id: str) -> bool:
        now = datetime.now(UTC)
        with self._lock:
            row = self._connections.get(connection_id)
            if not row or row["user_id"] != user_id or row["revoked_at"]:
                return False
            row["revoked_at"] = now
            for entry in self._refresh.values():
                if entry["connection_id"] == connection_id:
                    entry["revoked_at"] = now
            return True

    def revoke_refresh(self, refresh_hash: str, client_id: str) -> None:
        with self._lock:
            token = self._refresh.get(refresh_hash)
            if not token:
                return
            connection = self._connections.get(token["connection_id"])
            if not connection or connection["client_id"] != client_id:
                return
        self.revoke_connection(str(token["connection_id"]), str(connection["user_id"]))


class PostgreSQLOAuthRepository:
    """PostgreSQL persistence with atomic one-time code and refresh-token consumption."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def register_client(self, name: str, redirect_uris: list[str]) -> dict[str, Any]:
        row = {
            "client_id": f"cdl_{uuid4().hex}",
            "client_name": name,
            "redirect_uris": redirect_uris,
            "created_at": datetime.now(UTC),
        }
        with self._session_factory() as session:
            session.execute(sa.insert(oauth_clients).values(**row))
            session.commit()
        return row

    def get_client(self, client_id: str) -> dict[str, Any] | None:
        with self._session_factory() as session:
            row = (
                session.execute(select(oauth_clients).where(oauth_clients.c.client_id == client_id))
                .mappings()
                .first()
            )
        return dict(row) if row else None

    def create_code(self, code: str, row: dict[str, Any]) -> None:
        with self._session_factory() as session:
            session.execute(sa.insert(oauth_codes).values(code_hash=token_hash(code), **row))
            session.commit()

    def consume_code(
        self, code: str, client_id: str, redirect_uri: str, expected_challenge: str
    ) -> dict[str, Any] | None:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            statement = (
                sa.update(oauth_codes)
                .where(
                    oauth_codes.c.code_hash == token_hash(code),
                    oauth_codes.c.client_id == client_id,
                    oauth_codes.c.redirect_uri == redirect_uri,
                    oauth_codes.c.code_challenge == expected_challenge,
                    oauth_codes.c.consumed_at.is_(None),
                    oauth_codes.c.expires_at > now,
                )
                .values(consumed_at=now)
                .returning(*oauth_codes.c)
            )
            row = session.execute(statement).mappings().first()
            session.commit()
        return dict(row) if row else None

    def create_connection(
        self, row: dict[str, Any], refresh_hash: str, refresh_expires: datetime
    ) -> dict[str, Any]:
        with self._session_factory() as session:
            session.execute(sa.insert(oauth_connections).values(**row))
            session.execute(
                sa.insert(oauth_refresh_tokens).values(
                    token_hash=refresh_hash,
                    connection_id=row["id"],
                    expires_at=refresh_expires,
                    used_at=None,
                    revoked_at=None,
                )
            )
            session.commit()
        return row

    def rotate_refresh(
        self, old_hash: str, new_hash: str, new_expires: datetime, client_id: str
    ) -> dict[str, Any] | None:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            token = (
                session.execute(
                    select(oauth_refresh_tokens)
                    .where(oauth_refresh_tokens.c.token_hash == old_hash)
                    .with_for_update()
                )
                .mappings()
                .first()
            )
            if not token:
                return None
            connection = (
                session.execute(
                    select(oauth_connections)
                    .where(
                        oauth_connections.c.id == token["connection_id"],
                        oauth_connections.c.client_id == client_id,
                    )
                    .with_for_update()
                )
                .mappings()
                .first()
            )
            if not connection:
                return None
            if token["used_at"] is not None:
                session.execute(
                    sa.update(oauth_connections)
                    .where(
                        oauth_connections.c.id == token["connection_id"],
                        oauth_connections.c.revoked_at.is_(None),
                    )
                    .values(revoked_at=now)
                )
                session.execute(
                    sa.update(oauth_refresh_tokens)
                    .where(
                        oauth_refresh_tokens.c.connection_id == token["connection_id"],
                        oauth_refresh_tokens.c.revoked_at.is_(None),
                    )
                    .values(revoked_at=now)
                )
                session.commit()
                return None
            if token["revoked_at"] or token["expires_at"] <= now:
                return None
            if connection["revoked_at"]:
                return None
            session.execute(
                sa.update(oauth_refresh_tokens)
                .where(oauth_refresh_tokens.c.token_hash == old_hash)
                .values(used_at=now)
            )
            session.execute(
                sa.insert(oauth_refresh_tokens).values(
                    token_hash=new_hash,
                    connection_id=token["connection_id"],
                    expires_at=new_expires,
                    used_at=None,
                    revoked_at=None,
                )
            )
            session.execute(
                sa.update(oauth_connections)
                .where(oauth_connections.c.id == token["connection_id"])
                .values(last_used_at=now)
            )
            session.commit()
        return dict(connection)

    def get_connection(self, connection_id: str) -> dict[str, Any] | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(oauth_connections).where(oauth_connections.c.id == connection_id)
                )
                .mappings()
                .first()
            )
        return dict(row) if row else None

    def list_connections(self, user_id: str) -> list[dict[str, Any]]:
        with self._session_factory() as session:
            rows = (
                session.execute(
                    select(oauth_connections, oauth_clients.c.client_name)
                    .join(oauth_clients, oauth_clients.c.client_id == oauth_connections.c.client_id)
                    .where(
                        oauth_connections.c.user_id == user_id,
                        oauth_connections.c.revoked_at.is_(None),
                    )
                )
                .mappings()
                .all()
            )
        return [dict(row) for row in rows]

    def revoke_connection(self, connection_id: str, user_id: str) -> bool:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            result = session.execute(
                sa.update(oauth_connections)
                .where(
                    oauth_connections.c.id == connection_id,
                    oauth_connections.c.user_id == user_id,
                    oauth_connections.c.revoked_at.is_(None),
                )
                .values(revoked_at=now)
            )
            session.execute(
                sa.update(oauth_refresh_tokens)
                .where(
                    oauth_refresh_tokens.c.connection_id == connection_id,
                    oauth_refresh_tokens.c.revoked_at.is_(None),
                )
                .values(revoked_at=now)
            )
            session.commit()
        return bool(result.rowcount)

    def revoke_refresh(self, refresh_hash: str, client_id: str) -> None:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            token = (
                session.execute(
                    select(oauth_refresh_tokens).where(
                        oauth_refresh_tokens.c.token_hash == refresh_hash
                    )
                )
                .mappings()
                .first()
            )
            if not token:
                return
            connection = (
                session.execute(
                    select(oauth_connections).where(
                        oauth_connections.c.id == token["connection_id"],
                        oauth_connections.c.client_id == client_id,
                    )
                )
                .mappings()
                .first()
            )
            if not connection:
                return
            session.execute(
                sa.update(oauth_connections)
                .where(
                    oauth_connections.c.id == connection["id"],
                    oauth_connections.c.revoked_at.is_(None),
                )
                .values(revoked_at=now)
            )
            session.execute(
                sa.update(oauth_refresh_tokens)
                .where(
                    oauth_refresh_tokens.c.connection_id == connection["id"],
                    oauth_refresh_tokens.c.revoked_at.is_(None),
                )
                .values(revoked_at=now)
            )
            session.commit()


_memory_repository = InMemoryOAuthRepository()


def build_oauth_repository(
    repository_mode: str, session_factory: Callable[[], Session] | None = None
) -> InMemoryOAuthRepository | PostgreSQLOAuthRepository:
    if repository_mode == "postgres":
        if session_factory is None:
            raise ValueError("PostgreSQL OAuth repository requires a session factory.")
        return PostgreSQLOAuthRepository(session_factory)
    return _memory_repository
