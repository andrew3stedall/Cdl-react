import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.app import create_app
from cdl_api.repositories.postgres_dashboard_fdr import (
    fdr_calculation_inputs_table,
    fdr_ratings_table,
)
from cdl_api.repositories.postgres_fdr import PostgreSQLFixtureDifficultyRepository
from cdl_api.routers.fdr import get_fdr_repository


def _client(repository: PostgreSQLFixtureDifficultyRepository) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_fdr_repository] = lambda: repository
    return TestClient(app)


def _assert_fdr_round_trip(session_factory: sessionmaker[Session]) -> None:
    repository = PostgreSQLFixtureDifficultyRepository(session_factory)
    client = _client(repository)

    empty_response = client.get("/api/fdr")
    empty_audit_response = client.get("/api/fdr/calculation-inputs")

    assert empty_response.status_code == 200
    assert empty_response.json()["attack"]["rows"] == []
    assert empty_response.json()["defence"]["rows"] == []
    assert empty_response.json()["attack"]["available_teams"] == []
    assert "Arsenal" not in empty_response.text
    assert empty_audit_response.status_code == 200
    assert empty_audit_response.json() == []

    repository.seed_synthetic_data()
    repository.seed_synthetic_data()
    response = client.get(
        "/api/fdr",
        params={"team_id": "arsenal", "gameweek_start": 12, "gameweek_end": 12},
    )
    audit_response = client.get("/api/fdr/calculation-inputs")

    assert response.status_code == 200
    body = response.json()
    assert body["attack"]["rows"][0]["team"]["id"] == "arsenal"
    assert body["attack"]["rows"][0]["fixtures"][0]["rating"] == 4
    assert body["defence"]["rows"][0]["fixtures"][0]["rating"] == 3
    assert body["attack"]["rows"][0]["fixtures"][0]["opponent"]["id"] == "man-city"

    assert audit_response.status_code == 200
    assert len(audit_response.json()) == 1
    audit = audit_response.json()[0]
    assert audit["season"] == "2025/26"
    assert audit["contract_version"] == "fdr-input/v1"
    assert audit["algorithm_version"] == "synthetic-baseline/v1"
    assert audit["calculation_run_id"] == "synthetic-fdr-2025-26-v1"
    assert audit["source"] == "deterministic-synthetic-fixture"
    assert audit["fixture_count"] == 2
    assert len(audit["input_sha256"]) == 64
    assert audit["synthetic"] is True

    other_season_response = client.get(
        "/api/fdr",
        params={"season": "2026/27", "gameweek_start": 12, "gameweek_end": 12},
    )
    other_season_audit = client.get(
        "/api/fdr/calculation-inputs",
        params={"season": "2026/27"},
    )
    assert other_season_response.status_code == 200
    assert other_season_response.json()["attack"]["rows"] == []
    assert other_season_response.json()["defence"]["rows"] == []
    assert other_season_response.json()["attack"]["available_teams"] == []
    assert "Arsenal" not in other_season_response.text
    assert other_season_audit.status_code == 200
    assert other_season_audit.json() == []

    with session_factory() as session:
        rating_count = session.execute(
            select(func.count()).select_from(fdr_ratings_table)
        ).scalar_one()
        input_count = session.execute(
            select(func.count()).select_from(fdr_calculation_inputs_table)
        ).scalar_one()
        rating_payloads = (
            session.execute(
                select(fdr_ratings_table.c.payload_json).order_by(fdr_ratings_table.c.id)
            )
            .scalars()
            .all()
        )
        input_payloads = (
            session.execute(
                select(fdr_calculation_inputs_table.c.payload_json).order_by(
                    fdr_calculation_inputs_table.c.id
                )
            )
            .scalars()
            .all()
        )

    assert rating_count == 4
    assert input_count == 1
    assert all(payload["synthetic"] is True for payload in rating_payloads)
    assert all(payload["synthetic"] is True for payload in input_payloads)
    assert {payload["calculation_run_id"] for payload in rating_payloads} == {
        "synthetic-fdr-2025-26-v1"
    }


def test_fdr_reads_persisted_ratings_without_memory_fallback() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    fdr_ratings_table.create(engine)
    fdr_calculation_inputs_table.create(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)

    _assert_fdr_round_trip(session_factory)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_fdr_uses_migration_0007_ratings() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)

    with session_factory() as session:
        session.execute(fdr_ratings_table.delete())
        session.execute(fdr_calculation_inputs_table.delete())
        session.commit()

    _assert_fdr_round_trip(session_factory)
