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
from cdl_api.repositories.postgres_knockout_imports import (
    PostgreSQLHistoricalKnockoutImportRepository,
)
from cdl_api.repositories.postgres_league_fixtures import (
    cdl_fixtures_table,
    fixture_results_table,
    knockout_matches_table,
)
from cdl_api.services.historical_import_service import HistoricalImportService
from cdl_api.services.synthetic_knockout_export_adapter import SyntheticKnockoutExportAdapter


def _document(
    *,
    batch_id: str = "knockout-batch-1",
    target_fixture_id: str = "fixture-final-1",
    source_system: str = "deterministic-synthetic-knockout",
) -> dict:
    return {
        "export_version": "synthetic-knockout-export/v1",
        "batch_id": batch_id,
        "source_system": source_system,
        "rows": [
            {
                "match_key": "knockout-final-source-1",
                "target_match_id": "knockout-final-1",
                "fixture_source_key": "fixture-final-source-1",
                "target_fixture_id": target_fixture_id,
                "round_label": "Final",
                "rounds": ["Semi Final", "Final"],
                "winner": {
                    "id": "draft-team-1",
                    "name": "Synthetic Winner",
                    "short_name": "SYN",
                },
            }
        ],
    }


def _create_tables(engine: Engine) -> None:
    for table in HISTORICAL_IMPORT_PERSISTENCE_TABLES:
        table.create(engine)
    cdl_fixtures_table.create(engine)
    fixture_results_table.create(engine)
    knockout_matches_table.create(engine)


def _seed_dependencies(
    session_factory: sessionmaker[Session],
    *,
    include_result: bool = True,
) -> None:
    with session_factory() as session:
        session.execute(
            insert(cdl_fixtures_table).values(
                id="fixture-final-1",
                payload_json={"round_label": "Final", "synthetic": True},
            )
        )
        if include_result:
            session.execute(
                insert(fixture_results_table).values(
                    id="result-fixture-final-1",
                    payload_json={"fixture_id": "fixture-final-1", "synthetic": True},
                )
            )
        session.commit()


def _assert_release_path(session_factory: sessionmaker[Session]) -> None:
    adapter = SyntheticKnockoutExportAdapter()
    repository = PostgreSQLHistoricalKnockoutImportRepository(session_factory)
    service = HistoricalImportService(repository)
    batch = adapter.adapt(_document()).batch

    dry_run = service.execute(batch, dry_run=True)
    assert dry_run.projected_records == 1
    with session_factory() as session:
        assert session.execute(select(knockout_matches_table.c.id)).all() == []

    committed = service.execute(batch, dry_run=False)
    assert committed.projected_records == 1
    replay = service.execute(batch, dry_run=False)
    assert replay.repeated_batch is True
    assert replay.unchanged_domain_records == 1

    with session_factory() as session:
        match = session.execute(select(knockout_matches_table)).mappings().one()
    assert match["id"] == "knockout-final-1"
    assert match["payload_json"]["fixture_id"] == "fixture-final-1"
    assert match["payload_json"]["round_label"] == "Final"
    assert match["payload_json"]["rounds"] == ["Semi Final", "Final"]
    assert match["payload_json"]["winner"]["id"] == "draft-team-1"
    assert match["payload_json"]["synthetic"] is True


def test_knockout_adapter_projection_reviews_and_conflict_rollback() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)
    _seed_dependencies(session_factory)
    _assert_release_path(session_factory)

    adapter = SyntheticKnockoutExportAdapter()
    duplicate = _document(batch_id="knockout-duplicate")
    duplicate["rows"].append(dict(duplicate["rows"][0]))
    adapted = adapter.adapt(duplicate)
    assert adapted.review_diagnostics == ["duplicate knockout match key: knockout-final-source-1"]
    assert len(adapted.batch.records) == 1

    invalid_round = _document(batch_id="knockout-invalid-round")
    invalid_round["rows"][0]["round_label"] = "Quarter Final"
    with pytest.raises(ValueError, match="round label must be present"):
        adapter.adapt(invalid_round)

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
            batch_id="knockout-missing-result",
            source_system="deterministic-synthetic-knockout-missing",
        )
    )
    audit = HistoricalImportService(
        PostgreSQLHistoricalKnockoutImportRepository(missing_factory)
    ).execute(missing.batch, dry_run=False)
    assert audit.projected_records == 0
    assert audit.review_items == ["knockout-final-source-1"]
    with missing_factory() as session:
        reason = session.execute(select(import_review_items_table.c.payload_json)).scalar_one()
    assert reason["reason"] == "missing_result"

    conflict = adapter.adapt(_document(batch_id="knockout-conflict")).batch
    with session_factory() as session:
        session.execute(knockout_matches_table.delete())
        session.execute(
            insert(knockout_matches_table).values(
                id="knockout-final-1",
                payload_json={"fixture_id": "fixture-final-1", "round_label": "Conflicting"},
            )
        )
        session.commit()
    with pytest.raises(ValueError, match="already exists with different content"):
        HistoricalImportService(
            PostgreSQLHistoricalKnockoutImportRepository(session_factory)
        ).execute(conflict, dry_run=False)
    with session_factory() as session:
        existing = session.execute(
            select(import_batches_table.c.id).where(
                import_batches_table.c.id == "knockout-conflict"
            )
        ).all()
    assert existing == []

    unsupported = _document()
    unsupported["export_version"] = "synthetic-knockout-export/v2"
    with pytest.raises(ValueError, match="Unsupported synthetic knockout export version"):
        adapter.adapt(unsupported)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_knockout_projection_uses_migrated_tables() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)
    with session_factory() as session:
        session.execute(knockout_matches_table.delete())
        session.execute(fixture_results_table.delete())
        session.execute(cdl_fixtures_table.delete())
        for table in reversed(HISTORICAL_IMPORT_PERSISTENCE_TABLES):
            session.execute(table.delete())
        session.commit()
    _seed_dependencies(session_factory)
    _assert_release_path(session_factory)
