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


def test_user_preferences_endpoint_round_trip() -> None:
    client = TestClient(create_app())

    initial_response = client.get("/api/me/preferences")
    update_response = client.put("/api/me/preferences", json={"theme_preset": "compact"})
    final_response = client.get("/api/me/preferences")

    assert initial_response.status_code == 200
    assert initial_response.json() == {"theme_preset": "classic"}
    assert update_response.status_code == 200
    assert update_response.json() == {"theme_preset": "compact"}
    assert final_response.json() == {"theme_preset": "compact"}
