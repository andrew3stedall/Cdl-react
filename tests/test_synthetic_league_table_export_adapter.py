import os

import pytest
from sqlalchemy import create_engine, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.repositories.postgres_imports import (
    HISTORICAL_IMPORT_PERSISTENCE_TABLES,
    import_batches_table,
    import_review_items_table,
)
from cdl_api.repositories.postgres_league_fixtures import (
    cdl_fixtures_table,
    fixture_results_table,
    league_table_snapshots_table,
)
from cdl_api.repositories.postgres_league_table_imports import (
    PostgreSQLHistoricalLeagueTableImportRepository,
)
from cdl_api.services.historical_import_service import HistoricalImportService
from cdl_api.services.synthetic_league_table_export_adapter import (
    SyntheticLeagueTableSnapshotExportAdapter,
)


def _document(
    *,
    batch_id: str = "table-batch-1",
    target_fixture_id: str = "fixture-1",
    source_system: str = "deterministic-synthetic-table",
) -> dict:
    return {
        "export_version": "synthetic-league-table-export/v1",
        "batch_id": batch_id,
        "source_system": source_system,
        "rows": [
            {
                "snapshot_key": "table-source-gw-1",
                "target_snapshot_id": "table-gw-1",
                "gameweek_id": "gw-1",
                "fixture_source_keys": ["fixture-source-1"],
                "target_fixture_ids": [target_fixture_id],
                "rows": [
                    {
                        "position": 1,
                        "team": {
                            "id": "draft-team-1",
                            "name": "Synthetic Team",
                            "short_name": "SYN",
                        },
                        "played": 1,
                        "wins": 1,
                        "draws": 0,
                        "losses": 0,
                        "points_for": 50,
                        "points_against": 40,
                        "points_difference": 10,
                        "league_points": 3,
                    }
                ],
            }
        ],
    }


def _create_tables(engine: Engine) -> None:
    for table in HISTORICAL_IMPORT_PERSISTENCE_TABLES:
        table.create(engine)
    cdl_fixtures_table.create(engine)
    fixture_results_table.create(engine)
    league_table_snapshots_table.create(engine)


def _seed_dependencies(
    session_factory: sessionmaker[Session],
    *,
    include_result: bool = True,
) -> None:
    with session_factory() as session:
        session.execute(
            insert(cdl_fixtures_table).values(
                id="fixture-1",
                payload_json={"synthetic": True},
            )
        )
        if include_result:
            session.execute(
                insert(fixture_results_table).values(
                    id="result-fixture-1",
                    payload_json={"fixture_id": "fixture-1", "synthetic": True},
                )
            )
        session.commit()


def _assert_release_path(session_factory: sessionmaker[Session]) -> None:
    adapter = SyntheticLeagueTableSnapshotExportAdapter()
    repository = PostgreSQLHistoricalLeagueTableImportRepository(session_factory)
    service = HistoricalImportService(repository)
    batch = adapter.adapt(_document()).batch

    dry_run = service.execute(batch, dry_run=True)
    assert dry_run.projected_records == 1
    with session_factory() as session:
        assert session.execute(select(league_table_snapshots_table.c.id)).all() == []

    committed = service.execute(batch, dry_run=False)
    assert committed.projected_records == 1
    replay = service.execute(batch, dry_run=False)
    assert replay.repeated_batch is True
    assert replay.unchanged_domain_records == 1

    with session_factory() as session:
        snapshot = session.execute(select(league_table_snapshots_table)).mappings().one()
    assert snapshot["id"] == "table-gw-1"
    assert snapshot["payload_json"]["gameweek_id"] == "gw-1"
    assert snapshot["payload_json"]["fixture_ids"] == ["fixture-1"]
    assert snapshot["payload_json"]["rows"][0]["league_points"] == 3
    assert snapshot["payload_json"]["synthetic"] is True


def test_league_table_adapter_projection_reviews_and_conflict_rollback() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)
    _seed_dependencies(session_factory)
    _assert_release_path(session_factory)

    adapter = SyntheticLeagueTableSnapshotExportAdapter()
    duplicate = _document(batch_id="table-duplicate")
    duplicate["rows"].append(dict(duplicate["rows"][0]))
    adapted = adapter.adapt(duplicate)
    assert adapted.review_diagnostics == ["duplicate league-table snapshot key: table-source-gw-1"]
    assert len(adapted.batch.records) == 1

    missing_engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(missing_engine)
    missing_factory = sessionmaker(bind=missing_engine, class_=Session)
    _seed_dependencies(missing_factory, include_result=False)
    missing = adapter.adapt(
        _document(
            batch_id="table-missing-result",
            source_system="deterministic-synthetic-table-missing",
        )
    )
    audit = HistoricalImportService(
        PostgreSQLHistoricalLeagueTableImportRepository(missing_factory)
    ).execute(missing.batch, dry_run=False)
    assert audit.projected_records == 0
    assert audit.review_items == ["table-source-gw-1"]
    with missing_factory() as session:
        reason = session.execute(select(import_review_items_table.c.payload_json)).scalar_one()
    assert reason["reason"] == "missing_result"

    conflict = adapter.adapt(_document(batch_id="table-conflict")).batch
    with session_factory() as session:
        session.execute(league_table_snapshots_table.delete())
        session.execute(
            insert(league_table_snapshots_table).values(
                id="table-gw-1",
                payload_json={"rows": [], "source": "conflicting"},
            )
        )
        session.commit()
    with pytest.raises(ValueError, match="already exists with different content"):
        HistoricalImportService(
            PostgreSQLHistoricalLeagueTableImportRepository(session_factory)
        ).execute(conflict, dry_run=False)
    with session_factory() as session:
        existing = session.execute(
            select(import_batches_table.c.id).where(import_batches_table.c.id == "table-conflict")
        ).all()
    assert existing == []

    unsupported = _document()
    unsupported["export_version"] = "synthetic-league-table-export/v2"
    with pytest.raises(ValueError, match="Unsupported synthetic league-table export version"):
        adapter.adapt(unsupported)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_league_table_projection_uses_migrated_tables() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)
    with session_factory() as session:
        session.execute(league_table_snapshots_table.delete())
        session.execute(fixture_results_table.delete())
        session.execute(cdl_fixtures_table.delete())
        for table in reversed(HISTORICAL_IMPORT_PERSISTENCE_TABLES):
            session.execute(table.delete())
        session.commit()
    _seed_dependencies(session_factory)
    _assert_release_path(session_factory)
