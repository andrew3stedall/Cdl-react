from fastapi.testclient import TestClient

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.squad import InMemorySquadRepository
from cdl_api.routers.squad import get_squad_service, require_manager_session
from cdl_api.services.squad import SquadManagementService


def _authenticated_client(manager_id: str = "manager-1") -> TestClient:
    app = create_app()
    service = SquadManagementService(InMemorySquadRepository())
    app.dependency_overrides[get_squad_service] = lambda: service
    app.dependency_overrides[require_manager_session] = lambda: SessionUser(
        id=manager_id,
        email=f"{manager_id}@example.com",
        display_name="Manager",
        roles=["manager"],
    )
    return TestClient(app)


def test_squad_summary_endpoint_returns_shared_player_contract() -> None:
    client = TestClient(create_app())
    response = client.get("/api/squad/summary")
    assert response.status_code == 200
    payload = response.json()
    assert payload["manager_team"]["id"] == "team-castle"
    assert payload["total_players"] == 2
    assert payload["players"][0]["display_name"]
    assert payload["players"][0]["epl_team"]["id"]


def test_scouting_endpoint_filters_by_query_and_metric() -> None:
    client = TestClient(create_app())
    response = client.get(
        "/api/scouting/players",
        params={"q": "casey", "metric": "form"},
    )
    assert response.status_code == 200
    names = [player["display_name"] for player in response.json()["players"]]
    assert names == ["Casey Midfielder"]


def test_scouting_player_detail_endpoint_returns_canonical_player() -> None:
    client = TestClient(create_app())

    response = client.get("/api/scouting/players/player-1")

    assert response.status_code == 200
    assert response.json()["id"] == "player-1"
    assert response.json()["epl_team"]["id"] == "epl-ars"


def test_scouting_player_detail_endpoint_returns_not_found_for_unknown_player() -> None:
    client = TestClient(create_app())

    response = client.get("/api/scouting/players/does-not-exist")

    assert response.status_code == 404


def test_squad_workspace_combines_summary_and_attention_reads() -> None:
    client = _authenticated_client()

    response = client.get("/api/squad/workspace")

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["manager_team"]["id"] == "team-castle"
    assert payload["summary"]["total_players"] == 2
    assert payload["notifications"]["notifications"] == []
    assert payload["notifications"]["proposed_trade_count"] == 0


def test_interest_and_trade_routes_require_authentication() -> None:
    client = TestClient(create_app())
    assert client.get("/api/interests").status_code == 401
    assert client.post("/api/interests", json={"player_id": "player-3"}).status_code == 401
    assert client.get("/api/trades").status_code == 401
    trade_response = client.post(
        "/api/trades",
        json={
            "offered_to_team_id": "team-rival",
            "offered_player_ids": ["player-1"],
            "requested_player_ids": ["player-4"],
        },
    )
    assert trade_response.status_code == 401
    assert trade_response.json()["detail"] == "Authentication required."


def test_squad_changes_and_notifications_are_manager_scoped() -> None:
    client = TestClient(create_app())
    assert client.get("/api/squad/changes").status_code == 401
    assert client.get("/api/squad/notifications").status_code == 401

    authenticated = _authenticated_client()
    changes = authenticated.get("/api/squad/changes")
    notifications = authenticated.get("/api/squad/notifications")
    assert changes.status_code == 200
    assert changes.json() == {"available_to_add": []}
    assert notifications.status_code == 200
    assert notifications.json() == {"notifications": [], "proposed_trade_count": 0}


def test_interest_create_reload_duplicate_delete_and_validation_flow() -> None:
    client = _authenticated_client()
    create_response = client.post(
        "/api/interests",
        json={"player_id": "player-3", "note": "Scout"},
    )
    assert create_response.status_code == 200
    interest_id = create_response.json()["id"]

    listed = client.get("/api/interests")
    assert listed.status_code == 200
    assert [interest["id"] for interest in listed.json()] == [interest_id]

    duplicate = client.post("/api/interests", json={"player_id": "player-3"})
    assert duplicate.status_code == 422
    assert duplicate.json()["message"] == "Interest already exists."
    remaining = [interest["id"] for interest in client.get("/api/interests").json()]
    assert remaining == [interest_id]

    delete_response = client.delete(f"/api/interests/{interest_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted_interest_id"] == interest_id

    invalid_response = client.post("/api/interests", json={"player_id": "player-1"})
    assert invalid_response.status_code == 422
    assert invalid_response.json()["issues"][0]["rule_reference"] == "squad-size"


def test_trade_create_reload_update_and_rejected_write_flow() -> None:
    app = create_app()
    service = SquadManagementService(InMemorySquadRepository())
    active_manager = {"id": "manager-1"}
    app.dependency_overrides[get_squad_service] = lambda: service
    app.dependency_overrides[require_manager_session] = lambda: SessionUser(
        id=active_manager["id"],
        email="manager@example.com",
        display_name="Manager",
        roles=["manager"],
    )
    client = TestClient(app)

    create_response = client.post(
        "/api/trades",
        json={
            "offered_to_team_id": "team-rival",
            "offered_player_ids": ["player-1"],
            "requested_player_ids": ["player-4"],
        },
    )
    assert create_response.status_code == 200
    trade = create_response.json()
    assert trade["status"] == "proposed"
    assert trade["rule_references"][0]["href"] == "/rules#trade-window"

    listed = client.get("/api/trades")
    assert [proposal["id"] for proposal in listed.json()["trades"]] == [trade["id"]]

    invalid = client.post(
        "/api/trades",
        json={
            "offered_to_team_id": "team-rival",
            "offered_player_ids": ["player-3"],
            "requested_player_ids": ["player-4"],
        },
    )
    assert invalid.status_code == 422
    assert invalid.json()["message"] == "Invalid trade asset."

    unauthorized = client.put(
        f"/api/trades/{trade['id']}",
        json={"status": "accepted"},
    )
    assert unauthorized.status_code == 422
    assert unauthorized.json()["message"] == "Trade transition is not authorized."
    assert client.get("/api/trades").json()["trades"][0]["status"] == "proposed"

    active_manager["id"] = "manager-rival"
    accepted = client.put(
        f"/api/trades/{trade['id']}",
        json={"status": "accepted"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"

    stale = client.put(
        f"/api/trades/{trade['id']}",
        json={"status": "rejected"},
    )
    assert stale.status_code == 422
    assert stale.json()["message"] == "Trade is no longer pending."
    assert client.get("/api/trades").json()["trades"][0]["status"] == "accepted"
