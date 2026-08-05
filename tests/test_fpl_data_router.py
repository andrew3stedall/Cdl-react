from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from cdl_api.contracts.fpl_data import (
    FplCacheStatusResponse,
    FplRefreshResource,
    FplRefreshResponse,
    FplResourceRefreshResult,
    FplResourceStatus,
)
from cdl_api.contracts.session import SessionUser
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.fpl_data import get_fpl_service, require_fpl_manager, router


class FakeService:
    def status(self) -> FplCacheStatusResponse:
        return FplCacheStatusResponse(
            resources=[
                FplResourceStatus(
                    resource=FplRefreshResource.BOOTSTRAP_STATIC,
                    last_updated_at=datetime(2026, 8, 5, tzinfo=UTC),
                    last_fetch_status=200,
                    response_sha256="a" * 64,
                ),
                FplResourceStatus(resource=FplRefreshResource.FIXTURES),
            ],
            normalized_counts={
                "players": 600,
                "teams": 20,
                "gameweeks": 38,
                "fixtures": 380,
            },
        )

    def refresh(self, resources: list[FplRefreshResource]) -> FplRefreshResponse:
        return FplRefreshResponse(
            resources=[
                FplResourceRefreshResult(
                    resource=resource,
                    endpoint=f"https://fantasy.premierleague.com/api/{resource.value}/",
                    fetched_at=datetime(2026, 8, 5, tzinfo=UTC),
                    response_sha256="b" * 64,
                    records_upserted={resource.value: 1},
                )
                for resource in resources
            ]
        )


def _user(roles: list[str]) -> SessionUser:
    return SessionUser(
        id="manager-1",
        email="manager@example.com",
        display_name="Manager",
        roles=roles,
    )


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_fpl_service] = FakeService
    app.dependency_overrides[require_authenticated_session] = lambda: _user(["manager"])
    app.dependency_overrides[require_fpl_manager] = lambda: _user(["manager"])
    return TestClient(app)


def test_status_and_refresh_routes_return_typed_fpl_cache_evidence() -> None:
    client = _client()

    status_response = client.get("/api/fpl/status")
    refresh_response = client.post(
        "/api/fpl/refresh",
        json={"resources": ["bootstrap-static", "fixtures"]},
    )

    assert status_response.status_code == 200
    assert status_response.json()["normalized_counts"]["players"] == 600
    assert refresh_response.status_code == 200
    assert [item["resource"] for item in refresh_response.json()["resources"]] == [
        "bootstrap-static",
        "fixtures",
    ]


def test_manager_dependency_rejects_non_manager_roles() -> None:
    try:
        require_fpl_manager(_user(["member"]))
    except HTTPException as exc:
        assert exc.status_code == 403
    else:
        raise AssertionError("Expected non-manager FPL refresh access to be rejected.")
