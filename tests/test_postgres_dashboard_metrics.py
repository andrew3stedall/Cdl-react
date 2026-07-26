from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.app import create_app
from cdl_api.repositories.postgres_dashboard_fdr import dashboard_metric_catalog_table
from cdl_api.repositories.postgres_dashboard_metrics import PostgreSQLDashboardMetricRepository
from cdl_api.routers.dashboard import get_dashboard_metric_repository


def _client(repository: PostgreSQLDashboardMetricRepository) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_dashboard_metric_repository] = lambda: repository
    return TestClient(app)


def test_dashboard_metrics_read_persisted_catalog_without_memory_fallback() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    dashboard_metric_catalog_table.create(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)
    repository = PostgreSQLDashboardMetricRepository(session_factory)
    client = _client(repository)

    empty_response = client.get("/api/dashboard/metrics")

    assert empty_response.status_code == 200
    assert empty_response.json() == []

    repository.seed_synthetic_data()
    repository.seed_synthetic_data()
    response = client.get("/api/dashboard/metrics")

    assert response.status_code == 200
    assert [metric["id"] for metric in response.json()] == [
        "expected_points",
        "fantasy_points",
    ]
    assert all("Synthetic" in metric["description"] for metric in response.json())
