"""Authentication service layer."""

from cdl_api.contracts.auth import LoginRequest
from cdl_api.contracts.session import SessionState, SessionUser
from cdl_api.repositories.auth import InMemorySessionRepository, InMemoryUserRepository


class AuthenticationService:
    def __init__(
        self,
        users: InMemoryUserRepository,
        sessions: InMemorySessionRepository,
        development_secret: str,
    ) -> None:
        self._users = users
        self._sessions = sessions
        self._development_secret = development_secret

    def login(self, request: LoginRequest) -> tuple[str, SessionState] | None:
        user_record = self._users.get_by_email(request.email)
        if user_record is None or request.password != self._development_secret:
            return None

        user = SessionUser(
            id=user_record.id,
            email=user_record.email,
            display_name=user_record.display_name,
            roles=user_record.roles,
        )
        session_id = self._sessions.create(user)
        return session_id, SessionState(is_authenticated=True, user=user)

    def get_session(self, session_id: str | None) -> SessionState:
        user = self._sessions.get(session_id)
        return SessionState(is_authenticated=user is not None, user=user)

    def logout(self, session_id: str | None) -> SessionState:
        self._sessions.delete(session_id)
        return SessionState(is_authenticated=False, user=None)
