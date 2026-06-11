"""PostgreSQL-backed authentication repositories."""

from collections.abc import Callable
from uuid import uuid4

from sqlalchemy import JSON, Column, MetaData, String, Table, insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.auth import UserRecord

metadata = MetaData()

users_table = Table(
    "users",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("email", String(255), nullable=False, unique=True),
    Column("display_name", String(255), nullable=False),
    Column("roles", JSON(), nullable=False),
)

sessions_table = Table(
    "sessions",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("user_id", String(64), nullable=False),
)


class PostgreSQLUserRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_by_email(self, email: str) -> UserRecord | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(
                        users_table.c.id,
                        users_table.c.email,
                        users_table.c.display_name,
                        users_table.c.roles,
                    ).where(users_table.c.email == email.lower())
                )
                .mappings()
                .first()
            )

        if row is None:
            return None

        return UserRecord(
            id=row["id"],
            email=row["email"],
            display_name=row["display_name"],
            roles=list(row["roles"]),
        )

    def seed_demo_user(self) -> None:
        with self._session_factory() as session:
            existing = session.execute(
                select(users_table.c.id).where(users_table.c.email == "manager@example.com")
            ).first()
            if existing is not None:
                return

            session.execute(
                insert(users_table).values(
                    id="user-1",
                    email="manager@example.com",
                    display_name="Demo Manager",
                    roles=["manager"],
                )
            )
            session.commit()


class PostgreSQLSessionRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def create(self, user: SessionUser) -> str:
        session_id = str(uuid4())
        with self._session_factory() as session:
            session.execute(insert(sessions_table).values(id=session_id, user_id=user.id))
            session.commit()
        return session_id

    def get(self, session_id: str | None) -> SessionUser | None:
        if session_id is None:
            return None

        with self._session_factory() as session:
            row = (
                session.execute(
                    select(
                        sessions_table.c.id,
                        users_table.c.id.label("user_id"),
                        users_table.c.email,
                        users_table.c.display_name,
                        users_table.c.roles,
                    )
                    .join(users_table, sessions_table.c.user_id == users_table.c.id)
                    .where(sessions_table.c.id == session_id)
                )
                .mappings()
                .first()
            )

        if row is None:
            return None

        return SessionUser(
            id=row["user_id"],
            email=row["email"],
            display_name=row["display_name"],
            roles=list(row["roles"]),
        )

    def delete(self, session_id: str | None) -> None:
        if session_id is None:
            return

        with self._session_factory() as session:
            session.execute(sessions_table.delete().where(sessions_table.c.id == session_id))
            session.commit()
