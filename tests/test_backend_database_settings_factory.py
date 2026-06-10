from pathlib import Path

import pytest

from cdl_api.repositories.auth import InMemorySessionRepository, InMemoryUserRepository
from cdl_api.repositories.factory import UnsupportedRepositoryModeError, build_repositories
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


def test_postgres_repository_mode_fails_until_repositories_exist() -> None:
    settings = Settings(
        repository_mode="postgres",
        database_url="postgresql+psycopg://example/db",
    )

    with pytest.raises(UnsupportedRepositoryModeError, match="PostgreSQL repository mode"):
        build_repositories(settings)


def test_feature_and_wiki_document_factory_handoff() -> None:
    feature_content = FEATURE_PATH.read_text(encoding="utf-8")
    wiki_content = WIKI_PATH.read_text(encoding="utf-8")

    for phrase in [
        "Active implementation feature for issue #62",
        "Parent coordinator: #75",
        "Parent milestone: #76",
        "Depends on: #61",
        "CDL_REPOSITORY_MODE",
        "#78 remains blocked",
    ]:
        assert phrase in feature_content

    assert "RepositoryBundle" in wiki_content
    assert "#63 should add PostgreSQL-backed auth" in wiki_content
