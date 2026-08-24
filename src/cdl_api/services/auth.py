"""Authentication service layer."""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Protocol

from cdl_api.contracts.auth import LoginRequest
from cdl_api.contracts.session import SessionState, SessionUser
from cdl_api.google_identity import GoogleIdentity
from cdl_api.repositories.auth import SessionRecord, UserRecord


class AppleIdentityProtocol(Protocol):
    subject: str
    email: str
    display_name: str


class UserRepository(Protocol):
    def get_by_email(self, email: str) -> UserRecord | None: ...

    def get_by_id(self, user_id: str) -> UserRecord | None: ...

    def get_or_create_google_user(
        self,
        *,
        subject: str,
        email: str,
        display_name: str,
    ) -> UserRecord: ...

    def get_or_create_apple_user(
        self,
        *,
        subject: str,
        email: str,
        display_name: str,
    ) -> UserRecord: ...


class SessionRepository(Protocol):
    def create(self, user: SessionUser, expires_at: datetime | None = None) -> str: ...

    def get_record(self, session_id: str | None) -> SessionRecord | None: ...

    def get(self, session_id: str | None) -> SessionUser | None: ...

    def delete(self, session_id: str | None) -> None: ...


class AuthenticationService:
    def __init__(
        self,
        users: UserRepository,
        sessions: SessionRepository,
        development_secret: str,
        session_ttl_days: int = 30,
    ) -> None:
        self._users = users
        self._sessions = sessions
        self._development_secret = development_secret
        self._session_ttl = timedelta(days=session_ttl_days)

    def login(self, request: LoginRequest) -> tuple[str, SessionState] | None:
        user_record = self._users.get_by_email(request.email)
        password_matches = secrets.compare_digest(
            request.password,
            self._development_secret,
        )
        if user_record is None or not password_matches:
            return None

        return self._create_session(user_record)

    def login_google(self, identity: GoogleIdentity) -> tuple[str, SessionState]:
        user_record = self._users.get_or_create_google_user(
            subject=identity.subject,
            email=identity.email,
            display_name=identity.display_name,
        )
        return self._create_session(user_record)

    def login_apple(self, identity: AppleIdentityProtocol) -> tuple[str, SessionState]:
        user_record = self._users.get_or_create_apple_user(
            subject=identity.subject,
            email=identity.email,
            display_name=identity.display_name,
        )
        return self._create_session(user_record)

    def login_user(self, user_record: UserRecord) -> tuple[str, SessionState]:
        """Create an application session for an already verified identity."""
        return self._create_session(user_record)

    def _create_session(self, user_record: UserRecord) -> tuple[str, SessionState]:
        user = SessionUser(
            id=user_record.id,
            email=user_record.email,
            display_name=user_record.display_name,
            roles=user_record.roles,
        )
        expires_at = datetime.now(UTC) + self._session_ttl
        session_id = self._sessions.create(user, expires_at)
        return session_id, SessionState(
            is_authenticated=True,
            user=user,
            expires_at=expires_at,
        )

    def get_session(self, session_id: str | None) -> SessionState:
        record = self._sessions.get_record(session_id)
        return SessionState(
            is_authenticated=record is not None,
            user=record.user if record is not None else None,
            expires_at=record.expires_at if record is not None else None,
        )

    def logout(self, session_id: str | None) -> SessionState:
        self._sessions.delete(session_id)
        return SessionState(is_authenticated=False, user=None)
