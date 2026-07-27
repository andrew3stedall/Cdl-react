import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.contracts.imports import HistoricalImportBatch
from cdl_api.repositories.postgres_imports import (
    HISTORICAL_IMPORT_PERSISTENCE_TABLES,
    PostgreSQLHistoricalImportRepository,
)
from cdl_api.repositories.postgres_league_fixtures import cdl_fixtures_table
from cdl_api.services.historical_import_service import HistoricalImportService
from cdl_api.services.synthetic_fixture_export_adapter import SyntheticFixtureExportAdapter


def _export_payload(batch_id: str) -> dict[str, object]:
    return {
        "export_version": "synthetic-fixture-export/v1",
        "batch_id": batch_id,
        "source_system": "deterministic-synthetic-fixture-export",
        "rows": [
            {
                "fixture_key": "legacy-fixture-a",
                "target_fixture_id": "fixture-historical-1",
                "gameweek": 1,
                "home_team_id": "castle",
                "home_team_name": "Castle FC",
                "home_team_short_name": "CAS",
                "away_team_id": "drafton",
                "away_team_name": "Drafton",
                "away_team_short_name": "DRA",
                "status": "complete",
                "kickoff_label": "Synthetic historical fixture",
                "round_label": "Regular season",
                "detail_available": True,
            }
        ],
    }


def _expected_batch(batch_id: str) -> HistoricalImportBatch:
    return HistoricalImportBatch.model_validate(
        {
            "contract_version": "historical-import/v1",
            "batch_id": batch_id,
            "source_system": "deterministic-synthetic-fixture-export",
            "synthetic": True,
            "mappings": [
                {
                    "source_key": "legacy-fixture-a",
                    "target_id": "fixture-historical-1",
                }
            ],
            "records": [
                {
                    "source_record_id": "legacy-fixture-a",
                    "mapping_key": "legacy-fixture-a",
                    "entity_type": "cdl_fixture",
                    "payload": {
                        "gameweek": {
                            "id": "gw-1",
                            "name": "Gameweek 1",
                            "number": 1,
                        },
                        "home_team": {
                            "id": "castle",
                            "name": "Castle FC",
                            "short_name": "CAS",
                        },
                        "away_team": {
                            "id": "drafton",
                            "name": "Drafton",
                            "short_name": "DRA",
                        },
                        "status": "complete",
                        "kickoff_label": "Synthetic historical fixture",
                        "round_label": "Regular season",
                        "detail_available": True,
                    },
                }
            ],
        }
    )


def _assert_adapter_projection_parity(session_factory: sessionmaker[Session]) -> None:
    adapter = SyntheticFixtureExportAdapter()
    result = adapter.adapt(_export_payload("synthetic-adapter-1"))

    assert result.batch == _expected_batch("synthetic-adapter-1")
    assert result.mapping_diagnostics == [
        "legacy-fixture-a -> fixture-historical-1"
    ]
    assert result.review_diagnostics == []

    service = HistoricalImportService(PostgreSQLHistoricalImportRepository(session_factory))
    adapted_audit = service.execute(result.batch)
    expected_audit = service.execute(_expected_batch("synthetic-adapter-1"))

    assert adapted_audit.batch_digest == expected_audit.batch_digest
    assert adapted_audit.projected_records == expected_audit.projected_records == 1
    assert adapted_audit.created_payloads == expected_audit.created_payloads == 1

    duplicate_payload = _export_payload("synthetic-adapter-duplicate")
    duplicate_payload["rows"] = [
        *duplicate_payload["rows"],  # type: ignore[index]
        *duplicate_payload["rows"],  # type: ignore[index]
    ]
    duplicate = adapter.adapt(duplicate_payload)
    assert duplicate.review_diagnostics == [
        "duplicate fixture key: legacy-fixture-a"
    ]
    assert len(duplicate.batch.records) == 1

    with pytest.raises(ValueError, match="Unsupported synthetic fixture export version"):
        adapter.adapt(
            {
                **_export_payload("unsupported-adapter"),
                "export_version": "synthetic-fixture-export/v2",
            }
        )


def test_synthetic_fixture_adapter_matches_projection_contract() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in (*HISTORICAL_IMPORT_PERSISTENCE_TABLES, cdl_fixtures_table):
        table.create(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)

    _assert_adapter_projection_parity(session_factory)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_synthetic_fixture_adapter_projection() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)

    with session_factory() as session:
        session.execute(cdl_fixtures_table.delete())
        for table in reversed(HISTORICAL_IMPORT_PERSISTENCE_TABLES):
            session.execute(table.delete())
        session.commit()

    _assert_adapter_projection_parity(session_factory)
