from fastapi.testclient import TestClient

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionUser
from cdl_api.routers.squad import require_manager_session


def _authenticated_client() -> TestClient:
    app = create_app()
    app.dependency_overrides[require_manager_session] = lambda: SessionUser(
        id="manager-1",
        email="manager@example.com",
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
    response = client.get("/api/scouting/players", params={"q": "casey", "metric": "form"})
    assert response.status_code == 200
    assert [player["display_name"] for player in response.json()["players"]] == ["Casey Midfielder"]


def test_interest_routes_require_authentication() -> None:
    client = TestClient(create_app())
    assert client.get("/api/interests").status_code == 401
    assert client.post("/api/interests", json={"player_id": "player-3"}).status_code == 401


def test_interest_create_reload_duplicate_delete_and_validation_flow() -> None:
    client = _authenticated_client()
    create_response = client.post("/api/interests", json={"player_id": "player-3", "note": "Scout"})
    assert create_response.status_code == 200
    interest_id = create_response.json()["id"]

    listed = client.get("/api/interests")
    assert listed.status_code == 200
    assert [interest["id"] for interest in listed.json()] == [interest_id]

    duplicate = client.post("/api/interests", json={"player_id": "player-3"})
    assert duplicate.status_code == 422
    assert duplicate.json()["message"] == "Interest already exists."
    assert [interest["id"] for interest in client.get("/api/interests").json()] == [interest_id]

    delete_response = client.delete(f"/api/interests/{interest_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted_interest_id"] == interest_id

    invalid_response = client.post("/api/interests", json={"player_id": "player-1"})
    assert invalid_response.status_code == 422
    assert invalid_response.json()["issues"][0]["rule_reference"] == "squad-size"


def test_trade_create_and_update_flow_links_rules() -> None:
    client = TestClient(create_app())
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
    update_response = client.put(f"/api/trades/{trade['id']}", json={"status": "accepted"})
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "accepted"
