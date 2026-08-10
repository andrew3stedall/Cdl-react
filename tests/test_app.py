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
    assert presets[0]["name"] == "teal-light"
    assert [preset["name"] for preset in presets] == [
        "teal-light",
        "teal-dark",
        "teal-light-compact",
        "teal-dark-compact",
    ]


def test_user_preferences_endpoint_round_trip() -> None:
    client = TestClient(create_app())
    login_response = client.post(
        "/api/auth/login",
        json={"email": "manager@example.com", "password": "demo-login-secret"},
    )
    reset_response = client.put(
        "/api/me/preferences",
        json={"theme_preset": "teal-light", "attack_direction": "up"},
    )
    initial_response = client.get("/api/me/preferences")
    update_response = client.put(
        "/api/me/preferences",
        json={"theme_preset": "teal-dark-compact", "attack_direction": "down"},
    )
    final_response = client.get("/api/me/preferences")

    assert login_response.status_code == 200
    assert reset_response.status_code == 200
    assert initial_response.status_code == 200
    assert initial_response.json() == {"theme_preset": "teal-light", "attack_direction": "up"}
    assert update_response.status_code == 200
    assert update_response.json() == {
        "theme_preset": "teal-dark-compact",
        "attack_direction": "down",
    }
    assert final_response.json() == {
        "theme_preset": "teal-dark-compact",
        "attack_direction": "down",
    }
