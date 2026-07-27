import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.app import create_app
from cdl_api.repositories.postgres_dashboard_fdr import fdr_ratings_table
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

    assert empty_response.status_code == 200
    assert empty_response.json()["attack"]["rows"] == []
    assert empty_response.json()["defence"]["rows"] == []
    assert empty_response.json()["attack"]["available_teams"] == []
    assert "Arsenal" not in empty_response.text

    repository.seed_synthetic_data()
    repository.seed_synthetic_data()
    response = client.get(
        "/api/fdr",
        params={"team_id": "arsenal", "gameweek_start": 12, "gameweek_end": 12},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["attack"]["rows"][0]["team"]["id"] == "arsenal"
    assert body["attack"]["rows"][0]["fixtures"][0]["rating"] == 4
    assert body["defence"]["rows"][0]["fixtures"][0]["rating"] == 3
    assert body["attack"]["rows"][0]["fixtures"][0]["opponent"]["id"] == "man-city"

    with session_factory() as session:
        count = session.execute(
            select(func.count()).select_from(fdr_ratings_table)
        ).scalar_one()
        payloads = session.execute(
            select(fdr_ratings_table.c.payload_json).order_by(fdr_ratings_table.c.id)
        ).scalars()

    assert count == 4
    assert all(payload["synthetic"] is True for payload in payloads)


def test_fdr_reads_persisted_ratings_without_memory_fallback() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    fdr_ratings_table.create(engine)
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
        session.commit()

    _assert_fdr_round_trip(session_factory)
