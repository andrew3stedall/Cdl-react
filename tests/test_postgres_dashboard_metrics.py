import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.app import create_app
from cdl_api.repositories.postgres_dashboard_fdr import dashboard_metric_catalog_table
from cdl_api.repositories.postgres_dashboard_metrics import PostgreSQLDashboardMetricRepository
from cdl_api.routers.dashboard import get_dashboard_metric_repository


def _client(repository: PostgreSQLDashboardMetricRepository) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_dashboard_metric_repository] = lambda: repository
    return TestClient(app)


def _assert_catalog_round_trip(
    repository: PostgreSQLDashboardMetricRepository,
    session_factory: sessionmaker[Session],
) -> None:
    client = _client(repository)

    empty_response = client.get("/api/dashboard/metrics")

    assert empty_response.status_code == 200
    assert empty_response.json() == []

    repository.seed_synthetic_data()
    repository.seed_synthetic_data()
    response = client.get("/api/dashboard/metrics")

    assert response.status_code == 200
    assert [metric["id"] for metric in response.json()] == ["expected_points", "fantasy_points"]
    assert all("Synthetic" in metric["description"] for metric in response.json())

    with session_factory() as session:
        count = session.execute(
            select(func.count()).select_from(dashboard_metric_catalog_table)
        ).scalar_one()
        payloads = session.execute(
            select(dashboard_metric_catalog_table.c.payload_json).order_by(
                dashboard_metric_catalog_table.c.id
            )
        ).scalars()

    assert count == 2
    assert all(payload["id"] in {"expected_points", "fantasy_points"} for payload in payloads)


def test_dashboard_metrics_read_payload_catalog_without_memory_fallback() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    dashboard_metric_catalog_table.create(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)
    repository = PostgreSQLDashboardMetricRepository(session_factory)

    _assert_catalog_round_trip(repository, session_factory)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_dashboard_metrics_use_migration_0007_payload_schema() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)

    with session_factory() as session:
        session.execute(dashboard_metric_catalog_table.delete())
        session.commit()

    repository = PostgreSQLDashboardMetricRepository(session_factory)
    _assert_catalog_round_trip(repository, session_factory)
