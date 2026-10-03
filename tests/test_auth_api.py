from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionState
from cdl_api.google_identity import GoogleIdentity
from cdl_api.repositories.auth import InMemorySessionRepository, InMemoryUserRepository
from cdl_api.repositories.league_memberships import InMemoryLeagueMembershipRepository
from cdl_api.routers.auth import (
    get_auth_service,
    get_google_identity_verifier,
    get_league_membership_repository,
    get_session_for_request,
    get_user_repository,
)
from cdl_api.services.auth import AuthenticationService
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
    assert response.json()["engineering_previews_enabled"] is True


class StubGoogleIdentityVerifier:
    def verify(
        self,
        credential: str,
        *,
        allow_unlisted_email: bool = False,
    ) -> GoogleIdentity | None:
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


def test_google_invite_registration_allows_a_verified_unlisted_email(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CDL_GOOGLE_CLIENT_ID", "staging-client.apps.googleusercontent.com")
    monkeypatch.setenv("CDL_GOOGLE_ALLOWED_EMAILS", "andrew3stedall@gmail.com")
    from cdl_api.repositories.league_memberships import InMemoryLeagueMembershipRepository

    repository = InMemoryLeagueMembershipRepository()
    invite = repository.create_invite("commissioner-1", "castle").token

    class InviteGoogleIdentityVerifier:
        def verify(
            self,
            credential: str,
            *,
            allow_unlisted_email: bool = False,
        ) -> GoogleIdentity | None:
            if credential != "valid-google-credential" or not allow_unlisted_email:
                return None
            return GoogleIdentity(
                subject="google-invitee",
                email="new.manager@example.com",
                display_name="New Manager",
            )

    app = create_app()
    app.dependency_overrides[get_google_identity_verifier] = InviteGoogleIdentityVerifier
    app.dependency_overrides[get_league_membership_repository] = lambda: repository
    client = TestClient(app)

    response = client.post(
        "/api/auth/google",
        json={"credential": "valid-google-credential", "invite_token": invite},
        headers={"X-CDL-Google-Sign-In": "1"},
    )

    assert response.status_code == 200


def test_production_google_login_allows_assigned_member_without_allowlist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CDL_ENVIRONMENT", "production")
    monkeypatch.setenv("CDL_SESSION_COOKIE_SECURE", "true")
    monkeypatch.setenv("CDL_REPOSITORY_MODE", "postgres")
    monkeypatch.setenv("CDL_DATABASE_URL", "postgresql+psycopg://unused:unused@localhost/cdl")
    monkeypatch.setenv("CDL_DEVELOPMENT_LOGIN_SECRET", "production-test-secret")
    monkeypatch.setenv("CDL_GOOGLE_CLIENT_ID", "production-client.apps.googleusercontent.com")
    monkeypatch.delenv("CDL_GOOGLE_ALLOWED_EMAILS", raising=False)

    users = InMemoryUserRepository()
    sessions = InMemorySessionRepository()
    membership = InMemoryLeagueMembershipRepository()
    invite = membership.create_invite("commissioner-1", "castle").token
    membership.accept_invite(invite, "user-1", "manager@example.com", "Demo Manager")
    service = AuthenticationService(users, sessions, "production-test-secret")

    class ExistingMemberIdentityVerifier:
        def verify(
            self,
            credential: str,
            *,
            allow_unlisted_email: bool = False,
        ) -> GoogleIdentity | None:
            if credential == "valid-google-credential" and allow_unlisted_email:
                return GoogleIdentity("google-subject-1", "manager@example.com", "Demo Manager")
            return None

    app = create_app()
    app.dependency_overrides[get_auth_service] = lambda: service
    app.dependency_overrides[get_google_identity_verifier] = ExistingMemberIdentityVerifier
    app.dependency_overrides[get_league_membership_repository] = lambda: membership
    app.dependency_overrides[get_user_repository] = lambda: users
    client = TestClient(app)

    assert client.get("/api/auth/google/config").json() == {
        "enabled": True,
        "client_id": "production-client.apps.googleusercontent.com",
    }
    response = client.post(
        "/api/auth/google",
        json={"credential": "valid-google-credential"},
        headers={"X-CDL-Google-Sign-In": "1"},
    )
    assert response.status_code == 200


def test_production_google_login_denies_unlisted_nonmember(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CDL_ENVIRONMENT", "production")
    monkeypatch.setenv("CDL_SESSION_COOKIE_SECURE", "true")
    monkeypatch.setenv("CDL_REPOSITORY_MODE", "postgres")
    monkeypatch.setenv("CDL_DATABASE_URL", "postgresql+psycopg://unused:unused@localhost/cdl")
    monkeypatch.setenv("CDL_DEVELOPMENT_LOGIN_SECRET", "production-test-secret")
    monkeypatch.setenv("CDL_GOOGLE_CLIENT_ID", "production-client.apps.googleusercontent.com")
    monkeypatch.delenv("CDL_GOOGLE_ALLOWED_EMAILS", raising=False)
    users = InMemoryUserRepository()
    membership = InMemoryLeagueMembershipRepository()

    class NonMemberIdentityVerifier:
        def verify(
            self,
            credential: str,
            *,
            allow_unlisted_email: bool = False,
        ) -> GoogleIdentity | None:
            if credential == "valid-google-credential" and allow_unlisted_email:
                return GoogleIdentity("google-subject-2", "new@example.com", "New User")
            return None

    app = create_app()
    app.dependency_overrides[get_auth_service] = lambda: AuthenticationService(
        users, InMemorySessionRepository(), "production-test-secret"
    )
    app.dependency_overrides[get_google_identity_verifier] = NonMemberIdentityVerifier
    app.dependency_overrides[get_league_membership_repository] = lambda: membership
    app.dependency_overrides[get_user_repository] = lambda: users
    response = TestClient(app).post(
        "/api/auth/google",
        json={"credential": "valid-google-credential"},
        headers={"X-CDL-Google-Sign-In": "1"},
    )
    assert response.status_code == 401


def test_production_google_login_rejects_invalid_identity_without_server_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CDL_ENVIRONMENT", "production")
    monkeypatch.setenv("CDL_SESSION_COOKIE_SECURE", "true")
    monkeypatch.setenv("CDL_REPOSITORY_MODE", "postgres")
    monkeypatch.setenv("CDL_DATABASE_URL", "postgresql+psycopg://unused:unused@localhost/cdl")
    monkeypatch.setenv("CDL_DEVELOPMENT_LOGIN_SECRET", "production-test-secret")
    app = create_app()

    class InvalidIdentityVerifier:
        @staticmethod
        def verify(credential: str, *, allow_unlisted_email: bool = False) -> None:
            return None

    app.dependency_overrides[get_google_identity_verifier] = InvalidIdentityVerifier
    response = TestClient(app).post(
        "/api/auth/google",
        json={"credential": "invalid-google-credential"},
        headers={"X-CDL-Google-Sign-In": "1"},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "unauthenticated"


def test_production_google_member_lookup_outage_returns_retryable_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CDL_ENVIRONMENT", "production")
    monkeypatch.setenv("CDL_SESSION_COOKIE_SECURE", "true")
    monkeypatch.setenv("CDL_REPOSITORY_MODE", "postgres")
    monkeypatch.setenv("CDL_DATABASE_URL", "postgresql+psycopg://unused:unused@localhost/cdl")
    monkeypatch.setenv("CDL_DEVELOPMENT_LOGIN_SECRET", "production-test-secret")
    app = create_app()

    class ExistingMemberIdentityVerifier:
        @staticmethod
        def verify(credential: str, *, allow_unlisted_email: bool = False) -> GoogleIdentity:
            return GoogleIdentity("google-subject-1", "manager@example.com", "Demo Manager")

    class UnavailableUserRepository:
        @staticmethod
        def get_by_email(email: str) -> None:
            raise OperationalError("select user", {}, RuntimeError("database unavailable"))

    app.dependency_overrides[get_google_identity_verifier] = ExistingMemberIdentityVerifier
    app.dependency_overrides[get_user_repository] = UnavailableUserRepository
    response = TestClient(app).post(
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
