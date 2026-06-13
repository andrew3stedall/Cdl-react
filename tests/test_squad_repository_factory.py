import pytest

from cdl_api.database import build_session_factory
from cdl_api.repositories.factory import build_repositories
from cdl_api.repositories.postgres_auth import PostgreSQLUserRepository
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.repositories.squad import InMemorySquadRepository
from cdl_api.settings import Settings


def test_memory_repository_bundle_includes_squad_repository() -> None:
    repositories = build_repositories(Settings(repository_mode="memory"))

    assert isinstance(repositories.squad, InMemorySquadRepository)


def test_postgres_repository_bundle_includes_squad_repository(
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
    monkeypatch.setattr(PostgreSQLSquadRepository, "seed_demo_data", lambda _: None)

    repositories = build_repositories(settings)

    assert isinstance(repositories.squad, PostgreSQLSquadRepository)
