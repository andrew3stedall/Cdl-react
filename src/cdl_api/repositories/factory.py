"""Repository construction helpers."""

from dataclasses import dataclass

from cdl_api.database import build_session_factory
from cdl_api.repositories.auth import InMemorySessionRepository, InMemoryUserRepository
from cdl_api.repositories.postgres_auth import PostgreSQLSessionRepository, PostgreSQLUserRepository
from cdl_api.repositories.postgres_preferences import PostgreSQLUserPreferenceRepository
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository
from cdl_api.repositories.preferences import InMemoryUserPreferenceRepository
from cdl_api.repositories.squad import InMemorySquadRepository
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository
from cdl_api.settings import Settings


class UnsupportedRepositoryModeError(ValueError):
    """Raised when repository construction is requested for an unsupported mode."""


@dataclass(frozen=True)
class RepositoryBundle:
    users: object
    sessions: object
    preferences: object
    squad: object
    team_selection: object


_memory_bundle = RepositoryBundle(
    users=InMemoryUserRepository(),
    sessions=InMemorySessionRepository(),
    preferences=InMemoryUserPreferenceRepository(),
    squad=InMemorySquadRepository(),
    team_selection=InMemoryTeamSelectionRepository(),
)


def build_repositories(settings: Settings) -> RepositoryBundle:
    if settings.repository_mode == "memory":
        return _memory_bundle

    if settings.repository_mode == "postgres":
        session_factory = build_session_factory(settings)
        users = PostgreSQLUserRepository(session_factory)
        users.seed_demo_user()
        squad = PostgreSQLSquadRepository(session_factory)
        squad.seed_demo_data()
        return RepositoryBundle(
            users=users,
            sessions=PostgreSQLSessionRepository(session_factory),
            preferences=PostgreSQLUserPreferenceRepository(session_factory),
            squad=squad,
            team_selection=PostgreSQLTeamSelectionRepository(session_factory),
        )

    msg = f"Unsupported repository mode: {settings.repository_mode}"
    raise UnsupportedRepositoryModeError(msg)
