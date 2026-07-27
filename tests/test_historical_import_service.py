import os

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.contracts.imports import HistoricalImportBatch
from cdl_api.repositories.postgres_imports import (
    HISTORICAL_IMPORT_PERSISTENCE_TABLES,
    PostgreSQLHistoricalImportRepository,
    import_batches_table,
    import_conflicts_table,
    import_review_items_table,
    import_source_mappings_table,
    import_source_payloads_table,
)
from cdl_api.services.historical_import_service import HistoricalImportService


def _batch(batch_id: str, *, target_id: str = "team-1", points: int = 10) -> HistoricalImportBatch:
    return HistoricalImportBatch.model_validate(
        {
            "contract_version": "historical-import/v1",
            "batch_id": batch_id,
            "source_system": "deterministic-synthetic-export",
            "synthetic": True,
            "mappings": [{"source_key": "legacy-team-a", "target_id": target_id}],
            "records": [
                {
                    "source_record_id": "legacy-result-1",
                    "mapping_key": "legacy-team-a",
                    "entity_type": "result",
                    "payload": {"gameweek": 1, "points": points},
                }
            ],
        }
    )


def _count(session_factory: sessionmaker[Session], table: object) -> int:
    with session_factory() as session:
        return session.execute(select(func.count()).select_from(table)).scalar_one()


def _assert_import_round_trip(session_factory: sessionmaker[Session]) -> None:
    repository = PostgreSQLHistoricalImportRepository(session_factory)
    service = HistoricalImportService(repository)
    first_batch = _batch("synthetic-import-1")

    dry_run = service.execute(first_batch)
    assert dry_run.dry_run is True
    assert dry_run.created_payloads == 1
    assert _count(session_factory, import_batches_table) == 0

    first_run = service.execute(first_batch, dry_run=False)
    assert first_run.created_payloads == 1
    assert first_run.mapping_conflicts == []

    repeated_run = service.execute(first_batch, dry_run=False)
    assert repeated_run.repeated_batch is True
    assert repeated_run.unchanged_payloads == 1

    archive_run = service.execute(
        _batch("synthetic-import-2", points=12),
        dry_run=False,
    )
    assert archive_run.archived_payloads == 1

    conflict_run = service.execute(
        _batch("synthetic-import-3", target_id="team-2", points=14),
        dry_run=False,
    )
    assert conflict_run.mapping_conflicts == ["legacy-team-a"]
    assert conflict_run.review_items == ["legacy-result-1"]

    assert _count(session_factory, import_batches_table) == 3
    assert _count(session_factory, import_source_mappings_table) == 1
    assert _count(session_factory, import_source_payloads_table) == 2
    assert _count(session_factory, import_conflicts_table) == 1
    assert _count(session_factory, import_review_items_table) == 1

    with session_factory() as session:
        payloads = session.execute(select(import_source_payloads_table.c.payload_json)).scalars()
        stored_payloads = list(payloads)
    assert sum(payload["archived"] is True for payload in stored_payloads) == 1
    assert sum(payload["archived"] is False for payload in stored_payloads) == 1
    assert all(payload["synthetic"] is True for payload in stored_payloads)

    conflicting_repeat = _batch("synthetic-import-1", points=99)
    with pytest.raises(ValueError, match="different content"):
        service.execute(conflicting_repeat, dry_run=False)


def test_historical_import_contract_is_deterministic_and_idempotent() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in HISTORICAL_IMPORT_PERSISTENCE_TABLES:
        table.create(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)

    _assert_import_round_trip(session_factory)


def test_real_export_claim_is_rejected_without_validation() -> None:
    batch = _batch("unvalidated-real-import").model_copy(update={"synthetic": False})
    repository = PostgreSQLHistoricalImportRepository(lambda: None)  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="validated export evidence"):
        HistoricalImportService(repository).execute(batch)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_historical_import_release_path() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)

    with session_factory() as session:
        for table in reversed(HISTORICAL_IMPORT_PERSISTENCE_TABLES):
            session.execute(table.delete())
        session.commit()

    _assert_import_round_trip(session_factory)
