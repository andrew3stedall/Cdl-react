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
    app.dependency_overrides[get_preference_service] = lambda: UserPreferenceService(
        repository
    )
    app.dependency_overrides[require_authenticated_session] = lambda: _user(
        "manager-1"
    )
    client = TestClient(app)

    response = client.put("/api/me/preferences", json={"theme_preset": "dark"})

    assert response.status_code == 200
    assert response.json() == {"theme_preset": "dark"}
    assert client.get("/api/me/preferences").json() == {"theme_preset": "dark"}

    app.dependency_overrides[require_authenticated_session] = lambda: _user(
        "manager-2"
    )
    assert client.get("/api/me/preferences").json() == {"theme_preset": "classic"}

    response = client.put("/api/me/preferences", json={"theme_preset": "compact"})

    assert response.status_code == 200
    assert response.json() == {"theme_preset": "compact"}

    app.dependency_overrides[require_authenticated_session] = lambda: _user(
        "manager-1"
    )
    assert client.get("/api/me/preferences").json() == {"theme_preset": "dark"}
