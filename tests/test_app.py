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
        "adaptive",
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
        json={
            "theme_preset": "teal-dark",
            "attack_direction": "down",
            "fdr_scale": "RdBu",
            "fdr_scale_reversed": False,
            "fdr_display_mode": "fill",
        },
    )
    final_response = client.get("/api/me/preferences")

    assert login_response.status_code == 200
    assert reset_response.status_code == 200
    assert initial_response.status_code == 200
    assert initial_response.json() == {
        "theme_preset": "teal-light",
        "attack_direction": "up",
        "fdr_scale": "RdYlGn",
        "fdr_scale_reversed": True,
        "fdr_display_mode": "font",
        "light_theme_colour": "#0F766E",
        "dark_theme_colour": "#2DD4BF",
        "fdr_custom_min": "#2166AC",
        "fdr_custom_second": "#8CAFD2",
        "fdr_custom_mid": "#F7F7F7",
        "fdr_custom_fourth": "#D58891",
        "fdr_custom_max": "#B2182B",
    }
    assert update_response.status_code == 200
    assert update_response.json() == {
        "theme_preset": "teal-dark",
        "attack_direction": "down",
        "fdr_scale": "RdBu",
        "fdr_scale_reversed": False,
        "fdr_display_mode": "fill",
        "light_theme_colour": "#0F766E",
        "dark_theme_colour": "#2DD4BF",
        "fdr_custom_min": "#2166AC",
        "fdr_custom_second": "#8CAFD2",
        "fdr_custom_mid": "#F7F7F7",
        "fdr_custom_fourth": "#D58891",
        "fdr_custom_max": "#B2182B",
    }
    assert final_response.json() == {
        "theme_preset": "teal-dark",
        "attack_direction": "down",
        "fdr_scale": "RdBu",
        "fdr_scale_reversed": False,
        "fdr_display_mode": "fill",
        "light_theme_colour": "#0F766E",
        "dark_theme_colour": "#2DD4BF",
        "fdr_custom_min": "#2166AC",
        "fdr_custom_second": "#8CAFD2",
        "fdr_custom_mid": "#F7F7F7",
        "fdr_custom_fourth": "#D58891",
        "fdr_custom_max": "#B2182B",
    }
