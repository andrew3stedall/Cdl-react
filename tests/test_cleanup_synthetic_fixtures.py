from __future__ import annotations

import pytest
from sqlalchemy import create_engine, insert, select, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.cleanup_synthetic_fixtures import (
    cleanup_synthetic_fixture_rows,
    remove_synthetic_staging_fixtures,
)
from cdl_api.repositories.postgres_league_fixtures import (
    cdl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
    metadata,
)
from cdl_api.settings import Settings


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    metadata.create_all(engine)
    return sessionmaker(bind=engine, class_=Session)


def test_cleanup_removes_only_marked_fixtures_and_linked_rows() -> None:
    session_factory = _session_factory()
    with session_factory() as session:
        session.execute(
            insert(cdl_fixtures_table),
            [
                {"id": "synthetic-1", "payload_json": {"synthetic": True}},
                {"id": "castle-1", "payload_json": {"synthetic": False}},
                {"id": "unmarked-1", "payload_json": {"name": "Imported"}},
            ],
        )
        session.execute(
            insert(fixture_results_table),
            [
                {"id": "result-1", "payload_json": {"fixture_id": "synthetic-1", "home_score": 3}},
                {"id": "result-2", "payload_json": {"fixture_id": "castle-1", "home_score": 4}},
            ],
        )
        session.execute(
            insert(fixture_scoring_snapshots_table),
            [
                {"id": "snapshot-1", "payload_json": {"fixture_id": "synthetic-1"}},
                {"id": "snapshot-2", "payload_json": {"fixture_id": "castle-1"}},
            ],
        )
        session.commit()

    result = cleanup_synthetic_fixture_rows(session_factory)

    assert result.fixtures == 1
    assert result.results == 1
    assert result.scoring_snapshots == 1
    with session_factory() as session:
        remaining_fixture_ids = set(session.execute(select(cdl_fixtures_table.c.id)).scalars())
        remaining_result_ids = set(session.execute(select(fixture_results_table.c.id)).scalars())
        remaining_snapshot_ids = set(
            session.execute(select(fixture_scoring_snapshots_table.c.id)).scalars()
        )
    assert remaining_fixture_ids == {"castle-1", "unmarked-1"}
    assert remaining_result_ids == {"result-2"}
    assert remaining_snapshot_ids == {"snapshot-2"}


def test_cleanup_is_idempotent() -> None:
    session_factory = _session_factory()
    assert cleanup_synthetic_fixture_rows(session_factory).fixtures == 0
    assert cleanup_synthetic_fixture_rows(session_factory).results == 0


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"environment": "production"}, "restricted"),
        ({"repository_mode": "memory"}, "requires CDL_REPOSITORY_MODE=postgres"),
        ({"database_url": "sqlite:///local.db"}, "requires an explicit PostgreSQL"),
    ],
)
def test_cleanup_rejects_unsafe_targets(
    monkeypatch: pytest.MonkeyPatch,
    overrides: dict[str, object],
    message: str,
) -> None:
    monkeypatch.setenv("CDL_ALLOW_SYNTHETIC_FIXTURE_CLEANUP", "true")
    values: dict[str, object] = {
        "environment": "staging",
        "repository_mode": "postgres",
        "database_url": "postgresql+psycopg://user@database/cdl",
    }
    values.update(overrides)
    settings = Settings(**values)

    with pytest.raises(RuntimeError, match=message):
        remove_synthetic_staging_fixtures(settings)


def test_cleanup_requires_explicit_confirmation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CDL_ALLOW_SYNTHETIC_FIXTURE_CLEANUP", raising=False)
    settings = Settings(
        environment="staging",
        repository_mode="postgres",
        database_url="postgresql+psycopg://user@database/cdl",
    )

    with pytest.raises(RuntimeError, match="confirm synthetic fixture cleanup"):
        remove_synthetic_staging_fixtures(settings)
