from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_health_endpoint() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_theme_contract_endpoint() -> None:
    client = TestClient(create_app())

    response = client.get("/api/contracts/theme-presets")

    assert response.status_code == 200
    presets = response.json()
    assert presets[0]["name"] == "classic"
