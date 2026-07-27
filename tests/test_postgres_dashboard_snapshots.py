import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.app import create_app
from cdl_api.repositories.postgres_dashboard_config import PostgreSQLDashboardConfigRepository
from cdl_api.repositories.postgres_dashboard_fdr import (
    dashboard_aggregate_snapshots_table,
    dashboard_definitions_table,
)
from cdl_api.repositories.postgres_dashboard_snapshots import PostgreSQLDashboardSnapshotRepository
from cdl_api.routers.dashboard import (
    get_dashboard_config_repository,
    get_dashboard_query_repository,
)


def _client(
    config_repository: PostgreSQLDashboardConfigRepository,
    query_repository: PostgreSQLDashboardSnapshotRepository,
) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_dashboard_config_repository] = lambda: config_repository
    app.dependency_overrides[get_dashboard_query_repository] = lambda: query_repository
    return TestClient(app)


def _assert_snapshot_round_trip(session_factory: sessionmaker[Session]) -> None:
    config_repository = PostgreSQLDashboardConfigRepository(session_factory)
    query_repository = PostgreSQLDashboardSnapshotRepository(session_factory)
    config_repository.seed_synthetic_data()
    client = _client(config_repository, query_repository)

    empty_response = client.post(
        "/api/dashboard/widgets/team-points/query",
        json={"filters": [{"filter_id": "gameweek", "value": "Gameweek 12"}]},
    )

    assert empty_response.status_code == 200
    assert empty_response.json()["series"] == [
        {
            "metric_id": "fantasy_points",
            "label": "Points by CDL team",
            "points": [],
        },
    ]
    assert empty_response.json()["rows"] == []
    assert empty_response.json()["empty"] is True
    assert "Castle FC" not in empty_response.text

    empty_drilldown = client.post(
        "/api/dashboard/widgets/team-points/drilldown",
        json={"point_key": "castle", "filters": []},
    )
    assert empty_drilldown.status_code == 200
    assert empty_drilldown.json()["rows"] == []
    assert "Casey Midfielder" not in empty_drilldown.text

    query_repository.seed_synthetic_data()
    query_repository.seed_synthetic_data()
    response = client.post(
        "/api/dashboard/widgets/team-points/query",
        json={
            "filters": [
                {"filter_id": "gameweek", "value": "Gameweek 12"},
                {"filter_id": "cdl_team", "value": "Castle FC"},
            ]
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["series"][0]["points"] == [
        {
            "label": "Castle FC",
            "value": 74.0,
            "dimension_value": "Castle FC",
            "drilldown_key": "castle",
        },
    ]
    assert body["rows"][0]["cells"] == {
        "cdl_team": "Castle FC",
        "fantasy_points": 74.0,
    }

    seeded_drilldown = client.post(
        "/api/dashboard/widgets/team-points/drilldown",
        json={"point_key": "castle", "filters": []},
    )
    assert seeded_drilldown.status_code == 200
    assert seeded_drilldown.json()["rows"] == []
    assert "Casey Midfielder" not in seeded_drilldown.text

    with session_factory() as session:
        count = session.execute(
            select(func.count()).select_from(dashboard_aggregate_snapshots_table)
        ).scalar_one()
        payloads = (
            session.execute(
                select(dashboard_aggregate_snapshots_table.c.payload_json).order_by(
                    dashboard_aggregate_snapshots_table.c.id
                )
            )
            .scalars()
            .all()
        )

    assert count == 2
    assert all(payload["synthetic"] is True for payload in payloads)


def test_dashboard_widget_query_reads_persisted_snapshots_without_memory_fallback() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    dashboard_definitions_table.create(engine)
    dashboard_aggregate_snapshots_table.create(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)

    _assert_snapshot_round_trip(session_factory)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_dashboard_widget_query_uses_migration_0007_snapshots() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)

    with session_factory() as session:
        session.execute(dashboard_aggregate_snapshots_table.delete())
        session.execute(dashboard_definitions_table.delete())
        session.commit()

    _assert_snapshot_round_trip(session_factory)
