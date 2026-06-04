from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_checkpoint_four_lists_expected_features() -> None:
    client = TestClient(create_app())

    response = client.get("/api/modernisation/checkpoint-4")

    assert response.status_code == 200
    payload = response.json()
    assert payload["checkpoint"] == 4
    assert {feature["issue"] for feature in payload["features"]} == {41, 42, 43, 44, 45}


def test_gameweek_centre_and_fixture_detail_contracts() -> None:
    client = TestClient(create_app())

    centre = client.get("/api/modernisation/gameweek-centre/gw-4")
    detail = client.get("/api/modernisation/gameweek-centre/gw-4/fixtures/fixture-100")

    assert centre.status_code == 200
    centre_payload = centre.json()
    assert centre_payload["next_deadline"]["route"] == "/team-selection"
    assert centre_payload["editable_gameweek_id"] == "gw-5"
    assert {fixture["id"] for fixture in centre_payload["fixtures"]} >= {"fixture-100"}
    assert {"live", "official"}.issubset(centre_payload["tables"].keys())
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["score_breakdown"]["home"]["total"] == 61
    assert {item["kind"] for item in detail_payload["explanations"]} >= {
        "substitution",
        "chip",
        "source",
    }


def test_knockout_bracket_aggregate_tiebreaker_and_progression() -> None:
    client = TestClient(create_app())

    bracket = client.get("/api/modernisation/knockout/cup-2026/bracket")

    assert bracket.status_code == 200
    tie = bracket.json()["rounds"][0]["ties"][0]
    assert tie["aggregate"] == {"home": 110, "away": 111}
    assert tie["tiebreaker"]["used_only_scoring_lineup"] is True
    assert tie["winner"] == "Drafton"
    assert tie["progression_stored"] is True


def test_player_pool_availability_watchlist_and_detail_contracts() -> None:
    client = TestClient(create_app())

    pool = client.get("/api/modernisation/players")
    filtered = client.get("/api/modernisation/players?include_blocked=false&include_injured=false")
    detail = client.get("/api/modernisation/players/fpl-201")
    watchlist = client.post("/api/modernisation/players/fpl-112/watchlist")

    assert pool.status_code == 200
    players = pool.json()["players"]
    assert any(player["availability"] == "blocked" for player in players)
    assert any(player["status"] == "injured" for player in players)
    assert pool.json()["availability_reasons_visible"] is True
    assert filtered.status_code == 200
    assert all(player["availability"] != "blocked" for player in filtered.json()["players"])
    assert all(player["status"] != "injured" for player in filtered.json()["players"])
    assert detail.status_code == 200
    assert detail.json()["histories_separated"] is True
    assert detail.json()["fpl_history"]
    assert detail.json()["cdl_history"]
    assert watchlist.status_code == 200
    assert watchlist.json()["free_agency_preferences_separate"] is True
    assert all(item["private"] for item in watchlist.json()["watchlist"])


def test_player_comparison_and_squad_slot_analysis_contracts() -> None:
    client = TestClient(create_app())

    comparison = client.get("/api/modernisation/players/compare?player_ids=fpl-201,fpl-203")
    analysis = client.get("/api/modernisation/squad-analysis/season-team-castle")

    assert comparison.status_code == 200
    comparison_payload = comparison.json()
    assert {"points", "minutes", "form", "cost", "status", "availability"}.issubset(
        comparison_payload["metrics"]
    )
    assert comparison_payload["fixtures_included"] is True
    assert analysis.status_code == 200
    analysis_payload = analysis.json()
    assert analysis_payload["empty_slots"]
    assert analysis_payload["temporary_rights"]
    assert any(slot["status"] == "loaned_in" for slot in analysis_payload["filled_slots"])
    assert analysis_payload["position_colours"]["MID"] == "midfielder"
