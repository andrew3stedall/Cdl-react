import os

import pytest
from sqlalchemy import create_engine, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.repositories.postgres_epl_context_imports import (
    PostgreSQLHistoricalEplContextImportRepository,
)
from cdl_api.repositories.postgres_imports import (
    HISTORICAL_IMPORT_PERSISTENCE_TABLES,
    import_review_items_table,
)
from cdl_api.repositories.postgres_league_fixtures import (
    epl_fixtures_table,
    fixture_scoring_snapshots_table,
)
from cdl_api.services.historical_import_service import HistoricalImportService
from cdl_api.services.synthetic_epl_context_export_adapter import (
    SyntheticEplContextExportAdapter,
)


def _document(
    *,
    batch_id: str = "epl-context-batch-1",
    target_id: str = "epl-fixture-1",
    snapshot_id: str = "snapshot-fixture-1",
) -> dict:
    return {
        "export_version": "synthetic-epl-context-export/v1",
        "batch_id": batch_id,
        "source_system": "deterministic-synthetic-epl-context",
        "rows": [
            {
                "context_key": "epl-context-source-1",
                "target_epl_fixture_id": target_id,
                "scoring_snapshot_id": snapshot_id,
                "gameweek": 12,
                "home_team": {"id": "epl-ars", "name": "Arsenal", "short_name": "ARS"},
                "away_team": {"id": "epl-che", "name": "Chelsea", "short_name": "CHE"},
                "status": "started",
                "kickoff_label": "GW12 deterministic synthetic context",
            }
        ],
    }


def _prepare_linked_snapshot(session_factory: sessionmaker[Session]) -> None:
    with session_factory() as session:
        session.execute(
            insert(fixture_scoring_snapshots_table).values(
                id="snapshot-fixture-1",
                payload_json={
                    "fixture_id": "fixture-1",
                    "epl_fixture_ids": ["epl-fixture-1"],
                    "synthetic": True,
                },
            )
        )
        session.commit()


def _assert_release_path(session_factory: sessionmaker[Session]) -> None:
    adapter = SyntheticEplContextExportAdapter()
    repository = PostgreSQLHistoricalEplContextImportRepository(session_factory)
    service = HistoricalImportService(repository)
    adapted = adapter.adapt(_document())

    dry_run = service.execute(adapted.batch, dry_run=True)
    assert dry_run.projected_records == 1
    with session_factory() as session:
        assert session.execute(select(epl_fixtures_table.c.id)).all() == []

    committed = service.execute(adapted.batch, dry_run=False)
    assert committed.projected_records == 1
    replay = service.execute(adapted.batch, dry_run=False)
    assert replay.repeated_batch is True
    assert replay.unchanged_domain_records == 1

    with session_factory() as session:
        payload = session.execute(select(epl_fixtures_table.c.payload_json)).scalar_one()
    assert payload["id"] == "epl-fixture-1"
    assert payload["gameweek"]["number"] == 12
    assert payload["scoring_snapshot_id"] == "snapshot-fixture-1"
    assert payload["synthetic"] is True


def _create_tables(engine: Engine) -> None:
    for table in HISTORICAL_IMPORT_PERSISTENCE_TABLES:
        table.create(engine)
    fixture_scoring_snapshots_table.create(engine)
    epl_fixtures_table.create(engine)


def test_epl_context_projection_and_missing_link_reviews() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)
    _prepare_linked_snapshot(session_factory)
    _assert_release_path(session_factory)

    missing_snapshot = SyntheticEplContextExportAdapter().adapt(
        _document(
            batch_id="epl-context-missing-snapshot",
            snapshot_id="snapshot-missing",
        )
    )
    missing_audit = HistoricalImportService(
        PostgreSQLHistoricalEplContextImportRepository(session_factory)
    ).execute(missing_snapshot.batch, dry_run=False)
    assert missing_audit.projected_records == 0
    assert missing_audit.review_items == ["epl-context-source-1"]

    with session_factory() as session:
        session.execute(
            insert(fixture_scoring_snapshots_table).values(
                id="snapshot-fixture-2",
                payload_json={
                    "fixture_id": "fixture-2",
                    "epl_fixture_ids": [],
                    "synthetic": True,
                },
            )
        )
        session.commit()
    missing_link = SyntheticEplContextExportAdapter().adapt(
        _document(
            batch_id="epl-context-missing-link",
            snapshot_id="snapshot-fixture-2",
        )
    )
    link_audit = HistoricalImportService(
        PostgreSQLHistoricalEplContextImportRepository(session_factory)
    ).execute(missing_link.batch, dry_run=False)
    assert link_audit.projected_records == 0
    with session_factory() as session:
        reasons = session.execute(select(import_review_items_table.c.payload_json)).scalars().all()
    assert {payload["reason"] for payload in reasons} == {
        "missing_scoring_link",
        "missing_scoring_snapshot",
    }


def test_epl_context_adapter_duplicate_version_and_conflict_rollback() -> None:
    adapter = SyntheticEplContextExportAdapter()
    payload = _document()
    payload["rows"].append(dict(payload["rows"][0]))
    adapted = adapter.adapt(payload)
    assert adapted.review_diagnostics == ["duplicate EPL context key: epl-context-source-1"]
    assert len(adapted.batch.records) == 1

    payload["export_version"] = "synthetic-epl-context-export/v2"
    with pytest.raises(
        ValueError,
        match="Unsupported synthetic EPL context export version",
    ):
        adapter.adapt(payload)

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)
    _prepare_linked_snapshot(session_factory)
    with session_factory() as session:
        session.execute(
            insert(epl_fixtures_table).values(
                id="epl-fixture-1",
                payload_json={"id": "epl-fixture-1", "synthetic": False},
            )
        )
        session.commit()

    batch = adapter.adapt(_document(batch_id="epl-context-conflict")).batch
    with pytest.raises(ValueError, match="already exists with different content"):
        HistoricalImportService(
            PostgreSQLHistoricalEplContextImportRepository(session_factory)
        ).execute(batch, dry_run=False)
    with session_factory() as session:
        reviews = session.execute(select(import_review_items_table.c.id)).all()
    assert reviews == []


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_epl_context_projection_uses_migrated_tables() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)
    with session_factory() as session:
        tables = (
            epl_fixtures_table,
            fixture_scoring_snapshots_table,
            *reversed(HISTORICAL_IMPORT_PERSISTENCE_TABLES),
        )
        for table in tables:
            session.execute(table.delete())
        session.commit()
    _prepare_linked_snapshot(session_factory)
    _assert_release_path(session_factory)
