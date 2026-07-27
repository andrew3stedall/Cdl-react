import os

import pytest
from sqlalchemy import create_engine, insert, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.repositories.postgres_imports import (
    HISTORICAL_IMPORT_PERSISTENCE_TABLES,
    import_batches_table,
    import_review_items_table,
    import_source_payloads_table,
)
from cdl_api.repositories.postgres_league_fixtures import (
    cdl_fixtures_table,
    fixture_results_table,
)
from cdl_api.repositories.postgres_result_imports import (
    PostgreSQLHistoricalResultImportRepository,
)
from cdl_api.services.historical_import_service import HistoricalImportService
from cdl_api.services.synthetic_result_export_adapter import SyntheticResultExportAdapter


def _result_export(
    batch_id: str,
    *,
    result_key: str = "legacy-result-a",
    fixture_key: str = "legacy-fixture-a",
    target_fixture_id: str = "fixture-historical-1",
    home_score: int = 51,
) -> dict[str, object]:
    return {
        "export_version": "synthetic-result-export/v1",
        "batch_id": batch_id,
        "source_system": "deterministic-synthetic-result-export",
        "rows": [
            {
                "result_key": result_key,
                "fixture_key": fixture_key,
                "target_fixture_id": target_fixture_id,
                "home_score": home_score,
                "away_score": 47,
                "outcome": "home_win",
            }
        ],
    }


def _seed_fixture(session_factory: sessionmaker[Session], fixture_id: str) -> None:
    with session_factory() as session:
        session.execute(
            insert(cdl_fixtures_table).values(
                id=fixture_id,
                payload_json={
                    "id": fixture_id,
                    "status": "complete",
                    "synthetic": True,
                },
            )
        )
        session.commit()


def _assert_result_projection(session_factory: sessionmaker[Session]) -> None:
    adapter = SyntheticResultExportAdapter()
    service = HistoricalImportService(PostgreSQLHistoricalResultImportRepository(session_factory))
    adapted = adapter.adapt(_result_export("synthetic-result-1"))

    assert adapted.mapping_diagnostics == ["legacy-fixture-a -> fixture-historical-1"]
    assert adapted.review_diagnostics == []
    assert adapted.batch.records[0].entity_type == "cdl_result"

    dry_run = service.execute(adapted.batch)
    assert dry_run.dry_run is True
    assert dry_run.projected_records == 1
    with session_factory() as session:
        assert session.execute(select(fixture_results_table.c.id)).all() == []

    applied = service.execute(adapted.batch, dry_run=False)
    replay = service.execute(adapted.batch, dry_run=False)
    assert applied.projected_records == 1
    assert replay.repeated_batch is True
    assert replay.unchanged_domain_records == 1

    with session_factory() as session:
        result_payload = session.execute(
            select(fixture_results_table.c.payload_json).where(
                fixture_results_table.c.id == "result-fixture-historical-1"
            )
        ).scalar_one()
    assert result_payload["fixture_id"] == "fixture-historical-1"
    assert result_payload["home_score"] == 51
    assert result_payload["synthetic"] is True

    missing = adapter.adapt(
        _result_export(
            "synthetic-result-missing",
            result_key="legacy-result-missing",
            fixture_key="legacy-fixture-missing",
            target_fixture_id="fixture-missing",
        )
    )
    missing_audit = service.execute(missing.batch, dry_run=False)
    assert missing_audit.projected_records == 0
    assert missing_audit.review_items == ["legacy-result-missing"]
    with session_factory() as session:
        review_payload = session.execute(
            select(import_review_items_table.c.payload_json).where(
                import_review_items_table.c.payload_json["batch_id"].as_string()
                == "synthetic-result-missing"
            )
        ).scalar_one()
    assert review_payload["reason"] == "missing_fixture"

    conflicting = adapter.adapt(
        _result_export(
            "synthetic-result-conflict",
            result_key="legacy-result-conflict",
            fixture_key="legacy-fixture-conflict",
            home_score=52,
        )
    )
    with pytest.raises(ValueError, match="already exists with different content"):
        service.execute(conflicting.batch, dry_run=False)
    with session_factory() as session:
        assert (
            session.execute(
                select(import_batches_table.c.id).where(
                    import_batches_table.c.id == "synthetic-result-conflict"
                )
            ).scalar_one_or_none()
            is None
        )
        assert (
            session.execute(
                select(import_source_payloads_table.c.id).where(
                    import_source_payloads_table.c.payload_json["batch_id"].as_string()
                    == "synthetic-result-conflict"
                )
            ).all()
            == []
        )

    duplicate_payload = _result_export("synthetic-result-duplicate")
    duplicate_payload["rows"] = [
        *duplicate_payload["rows"],  # type: ignore[index]
        *duplicate_payload["rows"],  # type: ignore[index]
    ]
    duplicate = adapter.adapt(duplicate_payload)
    assert duplicate.review_diagnostics == ["duplicate result key: legacy-result-a"]
    assert len(duplicate.batch.records) == 1

    with pytest.raises(ValueError, match="Unsupported synthetic result export version"):
        adapter.adapt(
            {
                **_result_export("unsupported-result-adapter"),
                "export_version": "synthetic-result-export/v2",
            }
        )


def test_synthetic_result_adapter_projects_transactionally() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in (
        *HISTORICAL_IMPORT_PERSISTENCE_TABLES,
        cdl_fixtures_table,
        fixture_results_table,
    ):
        table.create(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)
    _seed_fixture(session_factory, "fixture-historical-1")

    _assert_result_projection(session_factory)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_synthetic_result_projection() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)

    with session_factory() as session:
        session.execute(fixture_results_table.delete())
        session.execute(cdl_fixtures_table.delete())
        for table in reversed(HISTORICAL_IMPORT_PERSISTENCE_TABLES):
            session.execute(table.delete())
        session.commit()
    _seed_fixture(session_factory, "fixture-historical-1")

    _assert_result_projection(session_factory)
