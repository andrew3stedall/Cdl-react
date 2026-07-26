import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.app import create_app
from cdl_api.repositories.postgres_dashboard_config import PostgreSQLDashboardConfigRepository
from cdl_api.repositories.postgres_dashboard_fdr import dashboard_definitions_table
from cdl_api.routers.dashboard import get_dashboard_config_repository


def _client(repository: PostgreSQLDashboardConfigRepository) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_dashboard_config_repository] = lambda: repository
    return TestClient(app)


def _assert_config_round_trip(
    repository: PostgreSQLDashboardConfigRepository,
    session_factory: sessionmaker[Session],
) -> None:
    client = _client(repository)

    empty_response = client.get("/api/dashboard/config")

    assert empty_response.status_code == 404
    assert empty_response.json()["code"] == "not_found"
    assert empty_response.json()["details"]["resource"] == "dashboard_definitions"

    repository.seed_synthetic_data()
    repository.seed_synthetic_data()
    response = client.get("/api/dashboard/config")

    assert response.status_code == 200
    assert response.json()["id"] == "manager-analytics"
    assert response.json()["widgets"][0]["id"] == "team-points"
    assert response.json()["metrics"][0]["id"] == "fantasy_points"

    with session_factory() as session:
        count = session.execute(
            select(func.count()).select_from(dashboard_definitions_table)
        ).scalar_one()
        payload = session.execute(
            select(dashboard_definitions_table.c.payload_json).where(
                dashboard_definitions_table.c.id == "manager-analytics"
            )
        ).scalar_one()

    assert count == 1
    assert payload["synthetic"] is True


def test_dashboard_config_reads_payload_without_memory_fallback() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    dashboard_definitions_table.create(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)
    repository = PostgreSQLDashboardConfigRepository(session_factory)

    _assert_config_round_trip(repository, session_factory)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_dashboard_config_uses_migration_0007_payload_schema() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)

    with session_factory() as session:
        session.execute(dashboard_definitions_table.delete())
        session.commit()

    repository = PostgreSQLDashboardConfigRepository(session_factory)
    _assert_config_round_trip(repository, session_factory)
