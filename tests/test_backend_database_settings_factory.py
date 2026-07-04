from pathlib import Path

import pytest

from cdl_api.database import build_session_factory
from cdl_api.repositories.auth import InMemorySessionRepository, InMemoryUserRepository
from cdl_api.repositories.factory import build_repositories
from cdl_api.repositories.postgres_auth import (
    PostgreSQLSessionRepository,
    PostgreSQLUserRepository,
)
from cdl_api.repositories.postgres_preferences import (
    PostgreSQLUserPreferenceRepository,
)
from cdl_api.repositories.postgres_team_selection import (
    PostgreSQLTeamSelectionRepository,
)
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository
from cdl_api.settings import Settings

FEATURE_PATH = Path("docs/features/active") / "backend-database-settings-and-repository-factory.md"
WIKI_PATH = Path("docs/wiki/backend-database-settings-and-repository-factory.md")


def test_settings_expose_database_and_repository_controls() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://example/db",
        database_pool_size=7,
        database_max_overflow=3,
        environment="test",
        repository_mode="memory",
    )

    assert settings.database_url == "postgresql+psycopg://example/db"
    assert settings.database_pool_size == 7
    assert settings.database_max_overflow == 3
    assert settings.environment == "test"
    assert settings.repository_mode == "memory"


def test_memory_repository_mode_builds_current_repositories() -> None:
    repositories = build_repositories(Settings(repository_mode="memory"))

    assert isinstance(repositories.users, InMemoryUserRepository)
    assert isinstance(repositories.sessions, InMemorySessionRepository)
    assert isinstance(repositories.team_selection, InMemoryTeamSelectionRepository)


def test_postgres_repository_mode_builds_database_repositories(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(
        repository_mode="postgres",
        database_url="postgresql+psycopg://example/db",
    )
    session_factory = build_session_factory(settings)

    monkeypatch.setattr(
        "cdl_api.repositories.factory.build_session_factory",
        lambda _: session_factory,
    )
    monkeypatch.setattr(PostgreSQLUserRepository, "seed_demo_user", lambda _: None)

    repositories = build_repositories(settings)

    assert isinstance(repositories.users, PostgreSQLUserRepository)
    assert isinstance(repositories.sessions, PostgreSQLSessionRepository)
    assert isinstance(repositories.preferences, PostgreSQLUserPreferenceRepository)
    assert isinstance(repositories.team_selection, PostgreSQLTeamSelectionRepository)


def test_feature_and_wiki_document_factory_handoff() -> None:
    feature_content = FEATURE_PATH.read_text(encoding="utf-8")
    wiki_content = WIKI_PATH.read_text(encoding="utf-8")

    for phrase in [
        "Active implementation feature for issue #62",
        "Parent coordinator: #75",
        "Parent milestone: #76",
        "Depends on: #61",
        "CDL_REPOSITORY_MODE",
        "#78 remains " + "blocked",
    ]:
        assert phrase in feature_content

    assert "RepositoryBundle" in wiki_content
    assert "#63 should add PostgreSQL-backed auth" in wiki_content
