import os

import pytest
from sqlalchemy import create_engine, insert, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.repositories.postgres_imports import (
    HISTORICAL_IMPORT_PERSISTENCE_TABLES,
)
from cdl_api.repositories.postgres_league_fixtures import (
    cdl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
)
from cdl_api.repositories.postgres_scoring_imports import (
    PostgreSQLHistoricalScoringImportRepository,
)
from cdl_api.services.historical_import_service import HistoricalImportService
from cdl_api.services.synthetic_scoring_export_adapter import (
    SyntheticScoringExportAdapter,
)


def _document(
    *,
    batch_id: str = "scoring-batch-1",
    target_id: str = "fixture-1",
) -> dict:
    return {
        "export_version": "synthetic-scoring-export/v1",
        "batch_id": batch_id,
        "source_system": "deterministic-synthetic-scoring",
        "rows": [
            {
                "snapshot_key": "snapshot-source-1",
                "fixture_key": "fixture-source-1",
                "target_fixture_id": target_id,
                "bonus_points": {"home": 2, "away": 1},
                "chips_played": {"home": "bench_boost"},
                "epl_fixture_ids": [],
            }
        ],
    }


def _assert_release_path(session_factory: sessionmaker[Session]) -> None:
    adapter = SyntheticScoringExportAdapter()
    repository = PostgreSQLHistoricalScoringImportRepository(session_factory)
    service = HistoricalImportService(repository)
    adapted = adapter.adapt(_document())

    dry_run = service.execute(adapted.batch, dry_run=True)
    assert dry_run.projected_records == 1
    with session_factory() as session:
        rows = session.execute(select(fixture_scoring_snapshots_table.c.id)).all()
        assert rows == []

    committed = service.execute(adapted.batch, dry_run=False)
    assert committed.projected_records == 1
    replay = service.execute(adapted.batch, dry_run=False)
    assert replay.repeated_batch is True
    assert replay.unchanged_domain_records == 1

    with session_factory() as session:
        payload = session.execute(
            select(fixture_scoring_snapshots_table.c.payload_json)
        ).scalar_one()
    assert payload["fixture_id"] == "fixture-1"
    assert payload["bonus_points"] == {"home": 2, "away": 1}
    assert payload["synthetic"] is True


def _prepare_dependencies(session_factory: sessionmaker[Session]) -> None:
    with session_factory() as session:
        session.execute(
            insert(cdl_fixtures_table).values(
                id="fixture-1",
                payload_json={"id": "fixture-1", "synthetic": True},
            )
        )
        session.execute(
            insert(fixture_results_table).values(
                id="result-fixture-1",
                payload_json={"fixture_id": "fixture-1", "synthetic": True},
            )
        )
        session.commit()


def test_scoring_adapter_projection_and_missing_dependency_reviews() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in HISTORICAL_IMPORT_PERSISTENCE_TABLES:
        table.create(engine)
    domain_tables = (
        cdl_fixtures_table,
        fixture_results_table,
        fixture_scoring_snapshots_table,
    )
    for table in domain_tables:
        table.create(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)
    _prepare_dependencies(session_factory)
    _assert_release_path(session_factory)

    missing_repository = PostgreSQLHistoricalScoringImportRepository(session_factory)
    missing_batch = (
        SyntheticScoringExportAdapter()
        .adapt(
            _document(
                batch_id="scoring-batch-missing",
                target_id="fixture-missing",
            )
        )
        .batch
    )
    audit = HistoricalImportService(missing_repository).execute(
        missing_batch,
        dry_run=False,
    )
    assert audit.projected_records == 0
    assert audit.review_items == ["snapshot-source-1"]


def test_scoring_adapter_duplicate_and_version_diagnostics() -> None:
    adapter = SyntheticScoringExportAdapter()
    payload = _document()
    payload["rows"].append(dict(payload["rows"][0]))
    adapted = adapter.adapt(payload)
    assert adapted.review_diagnostics == ["duplicate scoring snapshot key: snapshot-source-1"]
    assert len(adapted.batch.records) == 1

    payload["export_version"] = "synthetic-scoring-export/v2"
    with pytest.raises(
        ValueError,
        match="Unsupported synthetic scoring export version",
    ):
        adapter.adapt(payload)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_scoring_projection_uses_migrated_tables() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)
    with session_factory() as session:
        tables = (
            fixture_scoring_snapshots_table,
            fixture_results_table,
            cdl_fixtures_table,
            *reversed(HISTORICAL_IMPORT_PERSISTENCE_TABLES),
        )
        for table in tables:
            session.execute(table.delete())
        session.commit()
    _prepare_dependencies(session_factory)
    _assert_release_path(session_factory)
