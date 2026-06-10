"""Repository construction helpers."""

from dataclasses import dataclass

from cdl_api.repositories.auth import InMemorySessionRepository, InMemoryUserRepository
from cdl_api.settings import Settings


class UnsupportedRepositoryModeError(ValueError):
    """Raised when repository construction is requested for an unsupported mode."""


@dataclass(frozen=True)
class RepositoryBundle:
    users: InMemoryUserRepository
    sessions: InMemorySessionRepository


_memory_bundle = RepositoryBundle(
    users=InMemoryUserRepository(),
    sessions=InMemorySessionRepository(),
)


def build_repositories(settings: Settings) -> RepositoryBundle:
    if settings.repository_mode == "memory":
        return _memory_bundle

    msg = (
        "PostgreSQL repository mode is configured, but PostgreSQL-backed repositories "
        "are introduced by follow-up persistence issues."
    )
    raise UnsupportedRepositoryModeError(msg)
