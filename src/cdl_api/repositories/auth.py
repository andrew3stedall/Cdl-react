"""Authentication repositories for foundation-stage development."""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from cdl_api.contracts.session import SessionUser


@dataclass(frozen=True)
class UserRecord:
    id: str
    email: str
    display_name: str
    roles: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class SessionRecord:
    user: SessionUser
    expires_at: datetime


class InMemoryUserRepository:
    def __init__(self) -> None:
        self._users = {
            "manager@example.com": UserRecord(
                id="user-1",
                email="manager@example.com",
                display_name="Demo Manager",
                roles=["manager"],
            )
        }

    def get_by_email(self, email: str) -> UserRecord | None:
        return self._users.get(email.lower())

    def get_by_id(self, user_id: str) -> UserRecord | None:
        return next((user for user in self._users.values() if user.id == user_id), None)

    def get_or_create_external_user(
        self,
        *,
        provider: str,
        subject: str,
        email: str,
        display_name: str,
    ) -> UserRecord:
        normalized_email = email.lower()
        existing = self.get_by_email(normalized_email)
        if existing is not None:
            return existing

        user = UserRecord(
            id=f"{provider}:{subject}",
            email=normalized_email,
            display_name=display_name,
            roles=["manager"],
        )
        self._users[normalized_email] = user
        return user

    def get_or_create_google_user(
        self,
        *,
        subject: str,
        email: str,
        display_name: str,
    ) -> UserRecord:
        return self.get_or_create_external_user(
            provider="google",
            subject=subject,
            email=email,
            display_name=display_name,
        )

    def get_or_create_apple_user(
        self,
        *,
        subject: str,
        email: str,
        display_name: str,
    ) -> UserRecord:
        return self.get_or_create_external_user(
            provider="apple",
            subject=subject,
            email=email,
            display_name=display_name,
        )


class InMemorySessionRepository:
    def __init__(self, default_ttl: timedelta = timedelta(days=30)) -> None:
        self._sessions: dict[str, SessionRecord] = {}
        self._default_ttl = default_ttl

    def create(self, user: SessionUser, expires_at: datetime | None = None) -> str:
        session_id = str(uuid4())
        self._sessions[session_id] = SessionRecord(
            user=user,
            expires_at=expires_at or datetime.now(UTC) + self._default_ttl,
        )
        return session_id

    def get_record(self, session_id: str | None) -> SessionRecord | None:
        if session_id is None:
            return None
        record = self._sessions.get(session_id)
        if record is None:
            return None
        if record.expires_at <= datetime.now(UTC):
            self._sessions.pop(session_id, None)
            return None
        return record

    def get(self, session_id: str | None) -> SessionUser | None:
        record = self.get_record(session_id)
        return record.user if record is not None else None

    def delete(self, session_id: str | None) -> None:
        if session_id is not None:
            self._sessions.pop(session_id, None)
