import pytest
from fastapi.testclient import TestClient

from cdl_api.app import create_app


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
