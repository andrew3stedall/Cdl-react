import os

import pytest
from sqlalchemy import create_engine, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.repositories.postgres_head_to_head_imports import (
    PostgreSQLHistoricalHeadToHeadImportRepository,
)
from cdl_api.repositories.postgres_imports import (
    HISTORICAL_IMPORT_PERSISTENCE_TABLES,
    import_batches_table,
    import_review_items_table,
)
from cdl_api.repositories.postgres_league_fixtures import (
    cdl_fixtures_table,
    fixture_results_table,
    head_to_head_records_table,
)
from cdl_api.services.historical_import_service import HistoricalImportService
from cdl_api.services.synthetic_head_to_head_export_adapter import (
    SyntheticHeadToHeadExportAdapter,
)


def _document(*, batch_id: str = "head-to-head-batch-1") -> dict:
    return {
        "export_version": "synthetic-head-to-head-export/v1",
        "batch_id": batch_id,
        "source_system": "deterministic-synthetic-head-to-head",
        "rows": [
            {
                "record_key": "h2h-source-1",
                "target_record_id": "h2h-team-a-team-b",
                "team": {
                    "id": "team-a",
                    "name": "Synthetic A",
                    "short_name": "A",
                },
                "opponent": {
                    "id": "team-b",
                    "name": "Synthetic B",
                    "short_name": "B",
                },
                "fixture_source_keys": [
                    "fixture-source-1",
                    "fixture-source-2",
                ],
                "target_fixture_ids": ["fixture-1", "fixture-2"],
                "played": 2,
                "wins": 1,
                "draws": 1,
                "losses": 0,
                "points_for": 105,
                "points_against": 95,
            }
        ],
    }


def _create_tables(engine: Engine) -> None:
    for table in HISTORICAL_IMPORT_PERSISTENCE_TABLES:
        table.create(engine)
    cdl_fixtures_table.create(engine)
    fixture_results_table.create(engine)
    head_to_head_records_table.create(engine)


def _seed_dependencies(
    session_factory: sessionmaker[Session],
    *,
    include_second_result: bool = True,
) -> None:
    with session_factory() as session:
        for fixture_id in ("fixture-1", "fixture-2"):
            session.execute(
                insert(cdl_fixtures_table).values(
                    id=fixture_id,
                    payload_json={
                        "home_team": {"id": "team-a"},
                        "away_team": {"id": "team-b"},
                        "synthetic": True,
                    },
                )
            )
        session.execute(
            insert(fixture_results_table).values(
                id="result-fixture-1",
                payload_json={
                    "fixture_id": "fixture-1",
                    "home_score": 55,
                    "away_score": 45,
                },
            )
        )
        if include_second_result:
            session.execute(
                insert(fixture_results_table).values(
                    id="result-fixture-2",
                    payload_json={
                        "fixture_id": "fixture-2",
                        "home_score": 50,
                        "away_score": 50,
                    },
                )
            )
        session.commit()


def _assert_release_path(session_factory: sessionmaker[Session]) -> None:
    adapter = SyntheticHeadToHeadExportAdapter()
    service = HistoricalImportService(
        PostgreSQLHistoricalHeadToHeadImportRepository(session_factory)
    )
    batch = adapter.adapt(_document()).batch

    dry_run = service.execute(batch, dry_run=True)
    assert dry_run.projected_records == 1
    with session_factory() as session:
        assert session.execute(select(head_to_head_records_table.c.id)).all() == []

    committed = service.execute(batch, dry_run=False)
    assert committed.projected_records == 1
    replay = service.execute(batch, dry_run=False)
    assert replay.repeated_batch is True
    assert replay.unchanged_domain_records == 1

    with session_factory() as session:
        row = session.execute(select(head_to_head_records_table)).mappings().one()
    assert row["payload_json"]["played"] == 2
    assert row["payload_json"]["wins"] == 1
    assert row["payload_json"]["draws"] == 1
    assert row["payload_json"]["points_for"] == 105
    assert row["payload_json"]["fixture_ids"] == ["fixture-1", "fixture-2"]


def test_head_to_head_adapter_projection_reviews_and_conflict_rollback() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)
    _seed_dependencies(session_factory)
    _assert_release_path(session_factory)

    adapter = SyntheticHeadToHeadExportAdapter()
    duplicate = _document(batch_id="h2h-duplicate")
    duplicate["rows"].append(dict(duplicate["rows"][0]))
    adapted = adapter.adapt(duplicate)
    assert adapted.review_diagnostics == [
        "duplicate head-to-head key: h2h-source-1"
    ]
    assert len(adapted.batch.records) == 1

    invalid = _document(batch_id="h2h-invalid")
    invalid["rows"][0]["wins"] = 2
    with pytest.raises(ValueError, match="played must equal"):
        adapter.adapt(invalid)

    missing_engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(missing_engine)
    missing_factory = sessionmaker(bind=missing_engine, class_=Session)
    _seed_dependencies(missing_factory, include_second_result=False)
    missing = adapter.adapt(_document(batch_id="h2h-missing-result"))
    audit = HistoricalImportService(
        PostgreSQLHistoricalHeadToHeadImportRepository(missing_factory)
    ).execute(missing.batch, dry_run=False)
    assert audit.projected_records == 0
    assert audit.review_items == ["h2h-source-1"]
    with missing_factory() as session:
        reason = session.execute(
            select(import_review_items_table.c.payload_json)
        ).scalar_one()
    assert reason["reason"] == "missing_result"

    conflict = adapter.adapt(_document(batch_id="h2h-conflict")).batch
    with session_factory() as session:
        session.execute(head_to_head_records_table.delete())
        session.execute(
            insert(head_to_head_records_table).values(
                id="h2h-team-a-team-b",
                payload_json={"played": 99},
            )
        )
        session.commit()
    with pytest.raises(ValueError, match="already exists with different content"):
        HistoricalImportService(
            PostgreSQLHistoricalHeadToHeadImportRepository(session_factory)
        ).execute(conflict, dry_run=False)
    with session_factory() as session:
        existing = session.execute(
            select(import_batches_table.c.id).where(
                import_batches_table.c.id == "h2h-conflict"
            )
        ).all()
    assert existing == []

    unsupported = _document()
    unsupported["export_version"] = "synthetic-head-to-head-export/v2"
    with pytest.raises(
        ValueError,
        match="Unsupported synthetic head-to-head export version",
    ):
        adapter.adapt(unsupported)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_head_to_head_projection_uses_migrated_tables() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)
    with session_factory() as session:
        session.execute(head_to_head_records_table.delete())
        session.execute(fixture_results_table.delete())
        session.execute(cdl_fixtures_table.delete())
        for table in reversed(HISTORICAL_IMPORT_PERSISTENCE_TABLES):
            session.execute(table.delete())
        session.commit()
    _seed_dependencies(session_factory)
    _assert_release_path(session_factory)