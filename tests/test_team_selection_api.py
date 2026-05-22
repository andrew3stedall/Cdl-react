from fastapi.testclient import TestClient

from cdl_api.app import create_app


def valid_payload() -> dict[str, object]:
    return {
        "players": [
            {"player_id": "player-1", "slot": "starter", "slot_order": 1},
            {"player_id": "player-2", "slot": "starter", "slot_order": 2},
            {
                "player_id": "player-3",
                "slot": "starter",
                "slot_order": 3,
                "is_captain": True,
            },
            {
                "player_id": "player-4",
                "slot": "bench",
                "slot_order": 1,
                "is_vice_captain": True,
            },
            {"player_id": "player-5", "slot": "reserve", "slot_order": 1},
        ]
    }


def test_team_selection_load_endpoint() -> None:
    client = TestClient(create_app())

    response = client.get("/api/team-selection")

    assert response.status_code == 200
    payload = response.json()
    assert payload["manager_team"]["id"] == "team-castle"
    assert len(payload["lineup"]) == 5
    assert payload["chips"][0]["status"] == "available"


def test_team_selection_lineup_update_endpoint() -> None:
    client = TestClient(create_app())

    response = client.put("/api/team-selection/lineup", json=valid_payload())

    assert response.status_code == 200
    payload = response.json()
    assert sum(1 for player in payload["lineup"] if player["slot"] == "starter") == 3


def test_team_selection_lineup_validation_endpoint() -> None:
    client = TestClient(create_app())
    invalid_payload = valid_payload()
    invalid_payload["players"] = invalid_payload["players"][:-1]

    response = client.put("/api/team-selection/lineup", json=invalid_payload)

    assert response.status_code == 422
    payload = response.json()
    assert payload["code"] == "validation_error"
    rule_references = {issue["rule_reference"] for issue in payload["issues"]}
    assert "lineup-validation" in rule_references


def test_chip_activation_and_validation_endpoint() -> None:
    client = TestClient(create_app())

    response = client.put("/api/team-selection/chips/wildcard", json={"active": True})

    assert response.status_code == 200
    wildcard = next(chip for chip in response.json()["chips"] if chip["id"] == "wildcard")
    assert wildcard["status"] == "active"

    invalid_response = client.put("/api/team-selection/chips/bench-boost", json={"active": True})

    assert invalid_response.status_code == 422
    assert invalid_response.json()["issues"][0]["rule_reference"] == "chip-usage"


def test_fixture_summary_endpoint_includes_cdl_and_epl_context() -> None:
    client = TestClient(create_app())

    response = client.get("/api/team-selection/fixtures-summary")

    assert response.status_code == 200
    payload = response.json()
    assert payload["cdl_fixtures"][0]["home_team"]["id"] == "team-castle"
    assert payload["epl_fixtures"][0]["home_team"]["id"] == "epl-ars"
    assert payload["cdl_table"][0]["id"] == "team-castle"
