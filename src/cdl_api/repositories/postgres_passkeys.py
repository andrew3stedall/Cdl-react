"""PostgreSQL-backed passkey and WebAuthn challenge repositories."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Table,
    delete,
    insert,
    select,
    update,
)
from sqlalchemy.orm import Session

from cdl_api.repositories.passkeys import AuthChallengeRecord, PasskeyRecord
from cdl_api.repositories.postgres_auth import metadata

passkey_credentials_table = Table(
    "passkey_credentials",
    metadata,
    Column("credential_id", String(512), primary_key=True),
    Column("user_id", String(64), ForeignKey("users.id"), nullable=False),
    Column("public_key", LargeBinary(), nullable=False),
    Column("sign_count", Integer(), nullable=False, default=0),
    Column("transports", JSON(), nullable=False),
    Column("nickname", String(255), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("last_used_at", DateTime(timezone=True), nullable=True),
)

auth_challenges_table = Table(
    "auth_challenges",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("kind", String(32), nullable=False),
    Column("challenge", LargeBinary(), nullable=False),
    Column("user_id", String(64), ForeignKey("users.id"), nullable=True),
    Column("expires_at", DateTime(timezone=True), nullable=False),
)


class PostgreSQLPasskeyRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def list_for_user(self, user_id: str) -> list[PasskeyRecord]:
        with self._session_factory() as session:
            rows = (
                session.execute(
                    select(
                        passkey_credentials_table.c.credential_id,
                        passkey_credentials_table.c.user_id,
                        passkey_credentials_table.c.public_key,
                        passkey_credentials_table.c.sign_count,
                        passkey_credentials_table.c.transports,
                        passkey_credentials_table.c.nickname,
                    ).where(passkey_credentials_table.c.user_id == user_id)
                )
                .mappings()
                .all()
            )
        return [_passkey_from_row(row) for row in rows]

    def get(self, credential_id: str) -> PasskeyRecord | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(
                        passkey_credentials_table.c.credential_id,
                        passkey_credentials_table.c.user_id,
                        passkey_credentials_table.c.public_key,
                        passkey_credentials_table.c.sign_count,
                        passkey_credentials_table.c.transports,
                        passkey_credentials_table.c.nickname,
                    ).where(passkey_credentials_table.c.credential_id == credential_id)
                )
                .mappings()
                .first()
            )
        return _passkey_from_row(row) if row is not None else None

    def create(self, record: PasskeyRecord) -> None:
        with self._session_factory() as session:
            session.execute(
                insert(passkey_credentials_table).values(
                    credential_id=record.credential_id,
                    user_id=record.user_id,
                    public_key=record.public_key,
                    sign_count=record.sign_count,
                    transports=record.transports,
                    nickname=record.nickname,
                    created_at=datetime.now(UTC),
                )
            )
            session.commit()

    def update_sign_count(self, credential_id: str, sign_count: int) -> None:
        with self._session_factory() as session:
            session.execute(
                update(passkey_credentials_table)
                .where(passkey_credentials_table.c.credential_id == credential_id)
                .values(sign_count=sign_count, last_used_at=datetime.now(UTC))
            )
            session.commit()


class PostgreSQLAuthChallengeRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def create(
        self,
        *,
        kind: str,
        challenge: bytes,
        user_id: str | None,
        ttl: timedelta = timedelta(minutes=5),
    ) -> str:
        challenge_id = str(uuid4())
        with self._session_factory() as session:
            session.execute(
                insert(auth_challenges_table).values(
                    id=challenge_id,
                    kind=kind,
                    challenge=challenge,
                    user_id=user_id,
                    expires_at=datetime.now(UTC) + ttl,
                )
            )
            session.commit()
        return challenge_id

    def consume(
        self,
        challenge_id: str | None,
        *,
        kind: str,
        user_id: str | None = None,
    ) -> AuthChallengeRecord | None:
        if challenge_id is None:
            return None

        now = datetime.now(UTC)
        with self._session_factory() as session:
            query = select(
                auth_challenges_table.c.id,
                auth_challenges_table.c.kind,
                auth_challenges_table.c.challenge,
                auth_challenges_table.c.user_id,
                auth_challenges_table.c.expires_at,
            ).where(
                auth_challenges_table.c.id == challenge_id,
                auth_challenges_table.c.kind == kind,
                auth_challenges_table.c.expires_at > now,
            )
            if user_id is not None:
                query = query.where(auth_challenges_table.c.user_id == user_id)
            row = session.execute(query).mappings().first()
            if row is None:
                return None
            session.execute(
                delete(auth_challenges_table).where(auth_challenges_table.c.id == challenge_id)
            )
            session.commit()

        expires_at = row["expires_at"]
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        return AuthChallengeRecord(
            challenge_id=row["id"],
            kind=row["kind"],
            challenge=row["challenge"],
            user_id=row["user_id"],
            expires_at=expires_at,
        )


def _passkey_from_row(row: object) -> PasskeyRecord:
    mapping = row
    return PasskeyRecord(
        credential_id=mapping["credential_id"],  # type: ignore[index]
        user_id=mapping["user_id"],  # type: ignore[index]
        public_key=mapping["public_key"],  # type: ignore[index]
        sign_count=mapping["sign_count"],  # type: ignore[index]
        transports=list(mapping["transports"]),  # type: ignore[index]
        nickname=mapping["nickname"],  # type: ignore[index]
    )
