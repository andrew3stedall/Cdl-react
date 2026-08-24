from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionState
from cdl_api.google_identity import GoogleIdentity
from cdl_api.routers.auth import (
    get_auth_service,
    get_google_identity_verifier,
    get_session_for_request,
)
from cdl_api.settings import Settings


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


def test_staging_can_require_secure_session_cookie(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CDL_SESSION_COOKIE_SECURE", "true")
    client = TestClient(create_app())

    response = client.post(
        "/api/auth/login",
        json={"email": "manager@example.com", "password": "demo-login-secret"},
    )

    assert response.status_code == 200
    assert "Secure" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    assert "Max-Age=2592000" in response.headers["set-cookie"]


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


class StubGoogleIdentityVerifier:
    def verify(self, credential: str) -> GoogleIdentity | None:
        if credential != "valid-google-credential":
            return None
        return GoogleIdentity(
            subject="google-subject-1",
            email="andrew3stedall@gmail.com",
            display_name="Andrew Stedall",
        )


class DatabaseOutageAuthService:
    @staticmethod
    def _raise() -> None:
        raise OperationalError("SELECT 1", {}, Exception("database unavailable"))

    def get_session(self, session_id: str | None) -> None:
        self._raise()

    def login_google(self, identity: GoogleIdentity) -> None:
        self._raise()


class DatabasePoolTimeoutAuthService:
    @staticmethod
    def get_session(session_id: str | None) -> None:
        raise SQLAlchemyTimeoutError("connection pool exhausted")


def test_session_database_pool_timeout_returns_structured_503() -> None:
    app = create_app()
    app.dependency_overrides[get_auth_service] = DatabasePoolTimeoutAuthService
    client = TestClient(app)

    response = client.get("/api/auth/session")

    assert response.status_code == 503
    assert response.json() == {
        "code": "server_error",
        "message": "Session verification is temporarily unavailable. Retry.",
        "details": {},
    }


def test_request_session_reuses_staging_middleware_lookup() -> None:
    session = SessionState(is_authenticated=False, user=None)
    request = SimpleNamespace(state=SimpleNamespace(authenticated_session=session))

    class UnexpectedDatabaseLookup:
        @staticmethod
        def get_session(session_id: str | None) -> None:
            raise AssertionError("middleware session should be reused")

    assert get_session_for_request(request, Settings(), UnexpectedDatabaseLookup()) is session


def test_google_login_creates_application_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CDL_GOOGLE_CLIENT_ID", "staging-client.apps.googleusercontent.com")
    monkeypatch.setenv("CDL_GOOGLE_ALLOWED_EMAILS", "andrew3stedall@gmail.com")
    app = create_app()
    app.dependency_overrides[get_google_identity_verifier] = StubGoogleIdentityVerifier
    client = TestClient(app)

    config = client.get("/api/auth/google/config")
    response = client.post(
        "/api/auth/google",
        json={"credential": "valid-google-credential"},
        headers={"X-CDL-Google-Sign-In": "1"},
    )

    assert config.json() == {
        "enabled": True,
        "client_id": "staging-client.apps.googleusercontent.com",
    }
    assert response.status_code == 200
    assert response.json()["session"]["user"]["email"] == "andrew3stedall@gmail.com"
    assert client.get("/api/auth/session").json()["is_authenticated"] is True


def test_google_login_requires_same_origin_header() -> None:
    app = create_app()
    app.dependency_overrides[get_google_identity_verifier] = StubGoogleIdentityVerifier
    client = TestClient(app)

    response = client.post(
        "/api/auth/google",
        json={"credential": "valid-google-credential"},
    )

    assert response.status_code == 403
    assert response.json()["message"] == "Google sign-in request was rejected."


def test_session_database_outage_returns_structured_503() -> None:
    app = create_app()
    app.dependency_overrides[get_auth_service] = DatabaseOutageAuthService
    client = TestClient(app)

    response = client.get("/api/auth/session")

    assert response.status_code == 503
    assert response.json() == {
        "code": "server_error",
        "message": "Session verification is temporarily unavailable. Retry.",
        "details": {},
    }


def test_google_login_database_outage_returns_structured_503() -> None:
    app = create_app()
    app.dependency_overrides[get_auth_service] = DatabaseOutageAuthService
    app.dependency_overrides[get_google_identity_verifier] = StubGoogleIdentityVerifier
    client = TestClient(app)

    response = client.post(
        "/api/auth/google",
        json={"credential": "valid-google-credential"},
        headers={"X-CDL-Google-Sign-In": "1"},
    )

    assert response.status_code == 503
    assert response.json() == {
        "code": "server_error",
        "message": "Google sign-in is temporarily unavailable. Try again.",
        "details": {},
    }


def test_apple_and_passkey_configuration_is_disabled_by_default() -> None:
    client = TestClient(create_app())

    assert client.get("/api/auth/apple/config").json() == {"enabled": False}
    assert client.get("/api/auth/passkeys/config").json() == {
        "enabled": False,
        "rp_id": None,
    }


def test_configured_passkeys_issue_one_time_authentication_options(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CDL_PASSKEY_RP_ID", "staging.example.test")
    monkeypatch.setenv("CDL_PASSKEY_EXPECTED_ORIGIN", "https://staging.example.test")
    client = TestClient(create_app())

    config = client.get("/api/auth/passkeys/config")
    options = client.get("/api/auth/passkeys/authentication/options")

    assert config.json() == {"enabled": True, "rp_id": "staging.example.test"}
    assert options.status_code == 200
    assert isinstance(options.json()["challenge"], str)
    assert "cdl_passkey_challenge=" in options.headers["set-cookie"]
