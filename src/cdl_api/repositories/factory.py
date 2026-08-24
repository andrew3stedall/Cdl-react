"""Repository construction helpers."""

from dataclasses import dataclass

from cdl_api.database import build_session_factory
from cdl_api.repositories.auth import InMemorySessionRepository, InMemoryUserRepository
from cdl_api.repositories.fdr_custom_palettes import (
    InMemoryFdrCustomPaletteRepository,
    PostgreSQLFdrCustomPaletteRepository,
)
from cdl_api.repositories.league_repository import LeagueRepository
from cdl_api.repositories.passkeys import (
    InMemoryAuthChallengeRepository,
    InMemoryPasskeyRepository,
)
from cdl_api.repositories.postgres_auth import (
    PostgreSQLSessionRepository,
    PostgreSQLUserRepository,
)
from cdl_api.repositories.postgres_league_fixtures import PostgreSQLLeagueRepository
from cdl_api.repositories.postgres_passkeys import (
    PostgreSQLAuthChallengeRepository,
    PostgreSQLPasskeyRepository,
)
from cdl_api.repositories.postgres_preferences import PostgreSQLUserPreferenceRepository
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.repositories.postgres_team_selection import (
    PostgreSQLTeamSelectionRepository,
)
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
    fdr_custom_palettes: object
    squad: object
    team_selection: object
    league: object
    passkeys: object
    auth_challenges: object


_memory_bundle = RepositoryBundle(
    users=InMemoryUserRepository(),
    sessions=InMemorySessionRepository(),
    preferences=InMemoryUserPreferenceRepository(),
    fdr_custom_palettes=InMemoryFdrCustomPaletteRepository(),
    squad=InMemorySquadRepository(),
    team_selection=InMemoryTeamSelectionRepository(),
    league=LeagueRepository(),
    passkeys=InMemoryPasskeyRepository(),
    auth_challenges=InMemoryAuthChallengeRepository(),
)


def build_repositories(settings: Settings) -> RepositoryBundle:
    if settings.repository_mode == "memory":
        return _memory_bundle

    if settings.repository_mode == "postgres":
        session_factory = build_session_factory(settings)
        users = PostgreSQLUserRepository(session_factory)
        squad = PostgreSQLSquadRepository(session_factory)
        league = PostgreSQLLeagueRepository(session_factory)
        return RepositoryBundle(
            users=users,
            sessions=PostgreSQLSessionRepository(session_factory),
            preferences=PostgreSQLUserPreferenceRepository(session_factory),
            fdr_custom_palettes=PostgreSQLFdrCustomPaletteRepository(session_factory),
            squad=squad,
            team_selection=PostgreSQLTeamSelectionRepository(session_factory),
            league=league,
            passkeys=PostgreSQLPasskeyRepository(session_factory),
            auth_challenges=PostgreSQLAuthChallengeRepository(session_factory),
        )

    msg = f"Unsupported repository mode: {settings.repository_mode}"
    raise UnsupportedRepositoryModeError(msg)
