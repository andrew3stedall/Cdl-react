from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_manager_desk_returns_one_context_aware_read_model() -> None:
    response = TestClient(create_app()).get("/api/desk")

    assert response.status_code == 200
    payload = response.json()
    assert payload["context"] == "live"
    assert payload["gameweek"]["number"] == 1
    assert payload["selection"]["manager_team"]["id"] == "team-castle"
    assert payload["squad"]["summary"]["manager_team"]["id"] == "team-castle"
    assert payload["current_fixture"]["status"] == "started"
    assert payload["current_fixtures"]
    assert "league_table" in payload
    assert "available_players" in payload
