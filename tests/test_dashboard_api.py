from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_dashboard_catalog_endpoints_return_configured_values() -> None:
    client = TestClient(create_app())

    config_response = client.get("/api/dashboard/config")
    metrics_response = client.get("/api/dashboard/metrics")
    dimensions_response = client.get("/api/dashboard/dimensions")
    filters_response = client.get("/api/dashboard/filters")

    assert config_response.status_code == 200
    assert metrics_response.status_code == 200
    assert dimensions_response.status_code == 200
    assert filters_response.status_code == 200
    assert config_response.json()["widgets"][0]["id"] == "team-points"
    assert metrics_response.json()[0]["id"] == "fantasy_points"
    assert dimensions_response.json()[0]["id"] == "cdl_team"
    assert filters_response.json()[0]["id"] == "gameweek"


def test_dashboard_widget_query_endpoint_returns_chart_rows() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/dashboard/widgets/team-points/query",
        json={"filters": [{"filter_id": "cdl_team", "value": "Castle FC"}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["widget_id"] == "team-points"
    assert body["series"][0]["points"][0]["label"] == "Castle FC"
    assert body["rows"][0]["cells"]["fantasy_points"] == 74


def test_dashboard_widget_query_endpoint_validates_allowlisted_filters() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/dashboard/widgets/team-points/query",
        json={"filters": [{"filter_id": "raw_table_column", "value": "points"}]},
    )

    assert response.status_code == 200
    assert response.json()["empty"] is True
    assert response.json()["validation_issues"][0]["rule_reference"] == "dashboard-filters"


def test_dashboard_drilldown_and_missing_widget_endpoints() -> None:
    client = TestClient(create_app())

    drilldown_response = client.post(
        "/api/dashboard/widgets/team-points/drilldown",
        json={
            "point_key": "castle",
            "filters": [{"filter_id": "gameweek", "value": "Gameweek 12"}],
        },
    )
    missing_response = client.post("/api/dashboard/widgets/missing-widget/query", json={})

    assert drilldown_response.status_code == 200
    assert drilldown_response.json()["rows"][0]["cells"]["team"] == "Castle FC"
    assert missing_response.status_code == 404
    assert missing_response.json()["code"] == "not_found"
