"""Authentication repositories for foundation-stage development."""

from dataclasses import dataclass, field
from uuid import uuid4

from cdl_api.contracts.session import SessionUser


@dataclass(frozen=True)
class UserRecord:
    id: str
    email: str
    display_name: str
    roles: list[str] = field(default_factory=list)


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


class InMemorySessionRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionUser] = {}

    def create(self, user: SessionUser) -> str:
        session_id = str(uuid4())
        self._sessions[session_id] = user
        return session_id

    def get(self, session_id: str | None) -> SessionUser | None:
        if session_id is None:
            return None
        return self._sessions.get(session_id)

    def delete(self, session_id: str | None) -> None:
        if session_id is not None:
            self._sessions.pop(session_id, None)
