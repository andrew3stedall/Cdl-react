from fastapi.testclient import TestClient

from cdl_api.app import create_app
from cdl_api.routers.companion import get_companion_repository


class FakeCompanionRepository:
    def teams(self) -> list[dict[str, str | None]]:
        return [{"id": "team-1", "name": "Team One", "manager_name": "Manager One"}]

    def draft_picks(self) -> dict[str, object]:
        return {"draft_id": "draft-1", "status": "complete", "picks": []}

    def draw_results(self) -> list[dict[str, object]]:
        return []

    def squad_movements(self) -> list[dict[str, object]]:
        return []

    def trades(self) -> list[dict[str, object]]:
        return []

    def team_selections(self, gameweek: int | None = None) -> dict[str, object]:
        return {"gameweek": gameweek, "selections": []}


def test_companion_read_routes_are_public_and_return_contracts() -> None:
    app = create_app()
    app.dependency_overrides[get_companion_repository] = FakeCompanionRepository
    client = TestClient(app)

    assert client.get("/api/companion/teams").json()["teams"][0]["id"] == "team-1"
    assert client.get("/api/companion/draft-picks").json()["status"] == "complete"
    assert client.get("/api/companion/draw-results").json() == {"draws": []}
    assert client.get("/api/companion/squad-movements").json() == {"movements": []}
    assert client.get("/api/companion/trades").json() == {"trades": []}
    assert client.get("/api/companion/team-selections?gameweek=14").json() == {
        "gameweek": 14,
        "selections": [],
    }
    app.dependency_overrides.clear()


def test_companion_api_allows_cross_origin_read_requests() -> None:
    app = create_app()
    app.dependency_overrides[get_companion_repository] = FakeCompanionRepository
    client = TestClient(app)

    response = client.options(
        "/api/companion/teams",
        headers={"Origin": "https://companion.example", "Access-Control-Request-Method": "GET"},
    )

    assert response.status_code == 204
    assert response.headers["access-control-allow-origin"] == "*"
    assert "GET" in response.headers["access-control-allow-methods"]
    app.dependency_overrides.clear()
