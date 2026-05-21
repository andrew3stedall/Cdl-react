from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_login_session_and_logout_flow() -> None:
    client = TestClient(create_app())

    login_response = client.post(
        "/api/auth/login",
        json={"email": "manager@example.com", "password": "demo-login-secret"},
    )
    assert login_response.status_code == 200
    assert login_response.json()["session"]["is_authenticated"] is True

    session_response = client.get("/api/auth/session")
    assert session_response.status_code == 200
    assert session_response.json()["is_authenticated"] is True

    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200
    assert logout_response.json()["session"]["is_authenticated"] is False

    final_session_response = client.get("/api/auth/session")
    assert final_session_response.status_code == 200
    assert final_session_response.json()["is_authenticated"] is False


def test_login_rejects_invalid_credentials_without_enumerating_user() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/auth/login",
        json={"email": "manager@example.com", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "unauthenticated"
    assert response.json()["message"] == "Invalid email or password."


def test_anonymous_session_is_not_authenticated() -> None:
    client = TestClient(create_app())

    response = client.get("/api/auth/session")

    assert response.status_code == 200
    assert response.json()["is_authenticated"] is False
    assert response.json()["user"] is None
