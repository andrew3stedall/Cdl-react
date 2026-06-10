"""Repository construction helpers."""

from dataclasses import dataclass
from typing import Any

from cdl_api.database import build_session_factory
from cdl_api.repositories.auth import InMemorySessionRepository, InMemoryUserRepository
from cdl_api.repositories.postgres_auth import PostgreSQLSessionRepository, PostgreSQLUserRepository
from cdl_api.repositories.postgres_preferences import PostgreSQLUserPreferenceRepository
from cdl_api.repositories.preferences import InMemoryUserPreferenceRepository
from cdl_api.settings import Settings


class UnsupportedRepositoryModeError(ValueError):
    """Raised when repository construction is requested for an unsupported mode."""


@dataclass(frozen=True)
class RepositoryBundle:
    users: Any
    sessions: Any
    preferences: Any


_memory_bundle = RepositoryBundle(
    users=InMemoryUserRepository(),
    sessions=InMemorySessionRepository(),
    preferences=InMemoryUserPreferenceRepository(),
)


def build_repositories(settings: Settings) -> RepositoryBundle:
    if settings.repository_mode == "memory":
        return _memory_bundle

    if settings.repository_mode == "postgres":
        session_factory = build_session_factory(settings)
        users = PostgreSQLUserRepository(session_factory)
        users.seed_demo_user()
        return RepositoryBundle(
            users=users,
            sessions=PostgreSQLSessionRepository(session_factory),
            preferences=PostgreSQLUserPreferenceRepository(session_factory),
        )

    msg = f"Unsupported repository mode: {settings.repository_mode}"
    raise UnsupportedRepositoryModeError(msg)
