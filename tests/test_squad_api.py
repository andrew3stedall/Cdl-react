from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_squad_summary_endpoint_returns_shared_player_contract() -> None:
    client = TestClient(create_app())

    response = client.get("/api/squad/summary")

    assert response.status_code == 200
    payload = response.json()
    assert payload["manager_team"]["id"] == "team-castle"
    assert payload["total_players"] == 2
    assert payload["players"][0]["display_name"]
    assert payload["players"][0]["epl_team"]["id"]
    assert payload["players"][0]["epl_team"]["name"]


def test_scouting_endpoint_filters_by_query_and_metric() -> None:
    client = TestClient(create_app())

    response = client.get("/api/scouting/players", params={"q": "casey", "metric": "form"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["filters"]["query"] == "casey"
    assert [player["display_name"] for player in payload["players"]] == ["Casey Midfielder"]


def test_interest_create_delete_and_validation_flow() -> None:
    client = TestClient(create_app())

    create_response = client.post("/api/interests", json={"player_id": "player-3", "note": "Scout"})

    assert create_response.status_code == 200
    interest_id = create_response.json()["id"]

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
