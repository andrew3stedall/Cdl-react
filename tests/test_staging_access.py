import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError
from starlette.requests import Request
from starlette.responses import PlainTextResponse

from cdl_api.app import create_app
from cdl_api.settings import Settings
from cdl_api.staging_access import build_staging_access_middleware


@pytest.fixture
def staging_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("CDL_ENVIRONMENT", "staging")
    monkeypatch.setenv("CDL_SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("CDL_DEVELOPMENT_LOGIN_SECRET", "staging-test-secret")
    return TestClient(create_app())


def test_staging_allows_health_frontend_and_auth_bootstrap_routes(
    staging_client: TestClient,
) -> None:
    assert staging_client.get("/health").status_code == 200
    assert staging_client.get("/api/auth/session").status_code == 200
    assert staging_client.get("/api/auth/google/config").status_code == 200
    assert staging_client.post("/api/auth/logout").status_code == 200
    assert staging_client.get("/").status_code == 404


@pytest.mark.parametrize(
    "path",
    [
        "/api/dashboard",
        "/api/fdr",
        "/api/league",
        "/api/rules",
        "/api/team-selection",
        "/api/contracts/theme-presets",
        "/api/not-a-real-route",
        "/docs",
        "/openapi.json",
        "/redoc",
    ],
)
def test_staging_rejects_every_non_auth_api_and_schema_route_before_routing(
    staging_client: TestClient,
    path: str,
) -> None:
    response = staging_client.get(path)

    assert response.status_code == 401
    assert response.json() == {
        "code": "unauthenticated",
        "message": "Authentication required.",
        "details": {},
    }


def test_staging_login_unlocks_protected_api(staging_client: TestClient) -> None:
    login = staging_client.post(
        "/api/auth/login",
        json={"email": "manager@example.com", "password": "staging-test-secret"},
    )

    assert login.status_code == 200
    assert staging_client.get("/api/contracts/theme-presets").status_code == 200
    assert staging_client.get("/openapi.json").status_code == 200


def test_application_boundary_is_inactive_outside_staging() -> None:
    client = TestClient(create_app())

    assert client.get("/api/contracts/theme-presets").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_staging_refuses_known_default_login_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CDL_ENVIRONMENT", "staging")
    monkeypatch.delenv("CDL_DEVELOPMENT_LOGIN_SECRET", raising=False)

    with pytest.raises(RuntimeError, match="non-default login secret"):
        create_app()


def test_staging_rejects_partial_google_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CDL_ENVIRONMENT", "staging")
    monkeypatch.setenv("CDL_DEVELOPMENT_LOGIN_SECRET", "staging-test-secret")
    monkeypatch.setenv("CDL_GOOGLE_CLIENT_ID", "staging-client.apps.googleusercontent.com")
    monkeypatch.delenv("CDL_GOOGLE_ALLOWED_EMAILS", raising=False)

    with pytest.raises(RuntimeError, match="both a client ID and an email allowlist"):
        create_app()


def test_staging_access_converts_pool_timeout_to_503() -> None:
    class PoolTimeoutAuthService:
        @staticmethod
        def get_session(session_id: str | None) -> None:
            raise SQLAlchemyTimeoutError("connection pool exhausted")

    settings = Settings(
        environment="staging",
        development_login_secret="staging-test-secret",
    )
    middleware = build_staging_access_middleware(settings, PoolTimeoutAuthService())
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/contracts/theme-presets",
            "raw_path": b"/api/contracts/theme-presets",
            "query_string": b"",
            "headers": [],
            "client": ("testclient", 123),
            "server": ("testserver", 80),
            "scheme": "http",
            "http_version": "1.1",
        }
    )

    async def call_next(_: Request) -> PlainTextResponse:
        return PlainTextResponse("ok")

    response = asyncio.run(middleware(request, call_next))

    assert response.status_code == 503
