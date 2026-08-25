from fastapi.testclient import TestClient

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.preferences import InMemoryUserPreferenceRepository
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.preferences import get_preference_service
from cdl_api.services.preferences import UserPreferenceService


def _user(user_id: str) -> SessionUser:
    return SessionUser(
        id=user_id,
        email=f"{user_id}@example.com",
        display_name=user_id,
        roles=["manager"],
    )


def test_preferences_require_authentication() -> None:
    client = TestClient(create_app())

    response = client.get("/api/me/preferences")

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required."


def test_preferences_use_authenticated_user_identity() -> None:
    repository = InMemoryUserPreferenceRepository()
    app = create_app()
    app.dependency_overrides[get_preference_service] = lambda: UserPreferenceService(repository)
    app.dependency_overrides[require_authenticated_session] = lambda: _user("manager-1")
    client = TestClient(app)

    response = client.put(
        "/api/me/preferences",
        json={
            "theme_preset": "teal-dark",
            "attack_direction": "down",
            "fdr_scale": "RdBu",
            "fdr_scale_reversed": False,
            "fdr_display_mode": "fill",
            "light_theme_colour": "#2563EB",
            "dark_theme_colour": "#60A5FA",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "theme_preset": "teal-dark",
        "attack_direction": "down",
        "fdr_scale": "RdBu",
        "fdr_scale_reversed": False,
        "fdr_display_mode": "fill",
        "position_colour_scale": "Classic",
        "metric_colour_scale": "Blue",
        "metric_colour_scale_reversed": False,
        "light_theme_colour": "#2563EB",
        "dark_theme_colour": "#60A5FA",
        "fdr_custom_min": "#2166AC",
        "fdr_custom_second": "#8CAFD2",
        "fdr_custom_mid": "#F7F7F7",
        "fdr_custom_fourth": "#D58891",
        "fdr_custom_max": "#B2182B",
    }
    assert client.get("/api/me/preferences").json() == {
        "theme_preset": "teal-dark",
        "attack_direction": "down",
        "fdr_scale": "RdBu",
        "fdr_scale_reversed": False,
        "fdr_display_mode": "fill",
        "position_colour_scale": "Classic",
        "metric_colour_scale": "Blue",
        "metric_colour_scale_reversed": False,
        "light_theme_colour": "#2563EB",
        "dark_theme_colour": "#60A5FA",
        "fdr_custom_min": "#2166AC",
        "fdr_custom_second": "#8CAFD2",
        "fdr_custom_mid": "#F7F7F7",
        "fdr_custom_fourth": "#D58891",
        "fdr_custom_max": "#B2182B",
    }

    app.dependency_overrides[require_authenticated_session] = lambda: _user("manager-2")
    assert client.get("/api/me/preferences").json() == {
        "theme_preset": "teal-light",
        "attack_direction": "up",
        "fdr_scale": "RdYlGn",
        "fdr_scale_reversed": True,
        "fdr_display_mode": "font",
        "position_colour_scale": "Classic",
        "metric_colour_scale": "Blue",
        "metric_colour_scale_reversed": False,
        "light_theme_colour": "#0F766E",
        "dark_theme_colour": "#2DD4BF",
        "fdr_custom_min": "#2166AC",
        "fdr_custom_second": "#8CAFD2",
        "fdr_custom_mid": "#F7F7F7",
        "fdr_custom_fourth": "#D58891",
        "fdr_custom_max": "#B2182B",
    }

    response = client.put(
        "/api/me/preferences",
        json={
            "theme_preset": "teal-light",
            "attack_direction": "up",
            "fdr_scale": "Turbo",
            "fdr_scale_reversed": True,
            "fdr_display_mode": "font",
            "light_theme_colour": "#0F766E",
            "dark_theme_colour": "#2DD4BF",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "theme_preset": "teal-light",
        "attack_direction": "up",
        "fdr_scale": "Turbo",
        "fdr_scale_reversed": True,
        "fdr_display_mode": "font",
        "position_colour_scale": "Classic",
        "metric_colour_scale": "Blue",
        "metric_colour_scale_reversed": False,
        "light_theme_colour": "#0F766E",
        "dark_theme_colour": "#2DD4BF",
        "fdr_custom_min": "#2166AC",
        "fdr_custom_second": "#8CAFD2",
        "fdr_custom_mid": "#F7F7F7",
        "fdr_custom_fourth": "#D58891",
        "fdr_custom_max": "#B2182B",
    }

    app.dependency_overrides[require_authenticated_session] = lambda: _user("manager-1")
    assert client.get("/api/me/preferences").json() == {
        "theme_preset": "teal-dark",
        "attack_direction": "down",
        "fdr_scale": "RdBu",
        "fdr_scale_reversed": False,
        "fdr_display_mode": "fill",
        "position_colour_scale": "Classic",
        "metric_colour_scale": "Blue",
        "metric_colour_scale_reversed": False,
        "light_theme_colour": "#2563EB",
        "dark_theme_colour": "#60A5FA",
        "fdr_custom_min": "#2166AC",
        "fdr_custom_second": "#8CAFD2",
        "fdr_custom_mid": "#F7F7F7",
        "fdr_custom_fourth": "#D58891",
        "fdr_custom_max": "#B2182B",
    }
