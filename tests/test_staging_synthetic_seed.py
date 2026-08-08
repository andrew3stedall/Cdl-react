from __future__ import annotations

from dataclasses import dataclass

import pytest

from cdl_api.seed_staging import seed_synthetic_staging_data
from cdl_api.settings import Settings
from cdl_api.staging_draft_seed import DraftSeedResult


@dataclass
class _Seeder:
    calls: list[str]
    domain: str

    def seed_demo_user(self) -> None:
        self.calls.append(self.domain)

    def seed_demo_data(self) -> None:
        self.calls.append(self.domain)

    def seed_synthetic_data(self) -> None:
        self.calls.append(self.domain)


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "staging",
        "repository_mode": "postgres",
        "database_url": "postgresql+psycopg://user@database/cdl",
    }
    values.update(overrides)
    return Settings(**values)


def test_seed_requires_explicit_confirmation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CDL_ALLOW_SYNTHETIC_STAGING_SEED", raising=False)

    with pytest.raises(RuntimeError, match="confirm synthetic staging data"):
        seed_synthetic_staging_data(_settings())


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"environment": "production"}, "restricted"),
        ({"repository_mode": "memory"}, "requires CDL_REPOSITORY_MODE=postgres"),
        ({"database_url": "sqlite:///local.db"}, "requires an explicit PostgreSQL"),
    ],
)
def test_seed_rejects_unsafe_targets(
    monkeypatch: pytest.MonkeyPatch,
    overrides: dict[str, object],
    message: str,
) -> None:
    monkeypatch.setenv("CDL_ALLOW_SYNTHETIC_STAGING_SEED", "true")

    with pytest.raises(RuntimeError, match=message):
        seed_synthetic_staging_data(_settings(**overrides))


def test_seed_loads_each_idempotent_domain_once(monkeypatch: pytest.MonkeyPatch) -> None:
    import cdl_api.seed_staging as module

    calls: list[str] = []

    def _build_session_factory(_settings: Settings) -> object:
        return object()

    def _user_repository(_factory: object) -> _Seeder:
        return _Seeder(calls, "identity")

    def _squad_repository(_factory: object) -> _Seeder:
        return _Seeder(calls, "squad")

    def _league_repository(_factory: object) -> _Seeder:
        return _Seeder(calls, "league")

    def _draft_seed(_factory: object) -> DraftSeedResult:
        calls.append("draft")
        return DraftSeedResult(
            teams=8,
            players=160,
            ownerships=160,
            position_counts=((2, 5, 10, 3),) * 8,
        )

    monkeypatch.setenv("CDL_ALLOW_SYNTHETIC_STAGING_SEED", "true")
    monkeypatch.setattr(module, "build_session_factory", _build_session_factory)
    monkeypatch.setattr(module, "PostgreSQLUserRepository", _user_repository)
    monkeypatch.setattr(module, "PostgreSQLSquadRepository", _squad_repository)
    monkeypatch.setattr(module, "PostgreSQLLeagueRepository", _league_repository)
    monkeypatch.setattr(module, "seed_staging_snake_draft", _draft_seed)

    result = seed_synthetic_staging_data(_settings())

    assert calls == ["identity", "squad", "draft", "league"]
    assert result.synthetic is True
    assert result.domains == (
        "identity",
        "draft:8-teams/160-ownerships",
        "league",
    )
