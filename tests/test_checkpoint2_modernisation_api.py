from fastapi.testclient import TestClient

from cdl_api.app import create_app

VALID_343_STARTERS = [
    "fpl-101",
    "fpl-102",
    "fpl-107",
    "fpl-108",
    "fpl-103",
    "fpl-105",
    "fpl-109",
    "fpl-110",
    "fpl-104",
    "fpl-106",
    "fpl-111",
]
BENCH = ["fpl-112", "fpl-113", "fpl-114"]
RESERVES = ["fpl-115", "fpl-116"]


def test_checkpoint_two_lists_expected_features() -> None:
    client = TestClient(create_app())

    response = client.get("/api/modernisation/checkpoint-2")

    assert response.status_code == 200
    payload = response.json()
    assert payload["checkpoint"] == 2
    assert {feature["issue"] for feature in payload["features"]} == {35, 36, 37, 39, 40}


def test_lineup_validation_locking_and_auto_adjustment_contracts() -> None:
    client = TestClient(create_app())

    invalid_response = client.put(
        "/api/modernisation/lineups/season-team-drafton/gw-3",
        json={
            "starters": VALID_343_STARTERS,
            "bench": BENCH,
            "reserves": RESERVES,
            "captain_id": "fpl-112",
            "vice_captain_id": "fpl-103",
        },
    )
    valid_response = client.put(
        "/api/modernisation/lineups/season-team-drafton/gw-3",
        json={
            "starters": VALID_343_STARTERS,
            "bench": BENCH,
            "reserves": RESERVES,
            "captain_id": "fpl-104",
            "vice_captain_id": "fpl-103",
        },
    )
    auto_setup = client.put(
        "/api/modernisation/lineups/season-team-drafton/gw-4",
        json={
            "starters": VALID_343_STARTERS,
            "bench": BENCH,
            "reserves": RESERVES,
            "captain_id": "fpl-104",
            "vice_captain_id": "fpl-103",
        },
    )
    auto_adjusted = client.post(
        "/api/modernisation/lineups/season-team-drafton/gw-4/auto-adjust"
    )
    lock_response = client.post("/api/modernisation/lineups/season-team-drafton/gw-3/lock")
    locked_edit = client.put(
        "/api/modernisation/lineups/season-team-drafton/gw-3",
        json={
            "starters": VALID_343_STARTERS,
            "bench": BENCH,
            "reserves": RESERVES,
            "captain_id": "fpl-104",
            "vice_captain_id": "fpl-103",
        },
    )

    assert invalid_response.status_code == 200
    assert invalid_response.json()["validation"][0]["field"] == "captain_id"
    assert valid_response.status_code == 200
    assert auto_setup.status_code == 200
    assert auto_adjusted.status_code == 200
    assert auto_adjusted.json()["submitted_as_is"] is True
    assert lock_response.status_code == 200
    assert lock_response.json()["lineup"]["status"] == "locked"
    assert locked_edit.status_code == 409


def test_substitution_and_chip_contracts() -> None:
    client = TestClient(create_app())

    substitution = client.post("/api/modernisation/substitutions/apply")
    chip = client.post(
        "/api/modernisation/chips/activate",
        json={"season_team_id": "season-team-castle", "gameweek_id": "gw-2", "chip": "triple_captain"},
    )
    second_chip = client.post(
        "/api/modernisation/chips/activate",
        json={"season_team_id": "season-team-castle", "gameweek_id": "gw-2", "chip": "bench_boost"},
    )

    assert substitution.status_code == 200
    assert substitution.json()["substitutions"][0]["formation_preserved"] is True
    assert chip.status_code == 200
    assert chip.json()["chip_impact"]["chip"] == "triple_captain"
    assert second_chip.status_code == 409


def test_fixture_snapshot_finalisation_correction_and_table_contracts() -> None:
    client = TestClient(create_app())

    snapshot_response = client.post(
        "/api/modernisation/fixture-scoring/snapshots",
        json={"fixture_id": "fixture-1", "source_hash": "event-live-hash-2", "mode": "provisional"},
    )
    snapshot_id = snapshot_response.json()["snapshot"]["id"]
    finalised_response = client.post(
        f"/api/modernisation/fixture-scoring/snapshots/{snapshot_id}/finalise"
    )
    correction_response = client.post(
        "/api/modernisation/fixture-scoring/corrections",
        json={
            "fixture_id": "fixture-1",
            "reason": "Commissioner correction",
            "home_score": 12,
            "away_score": 9,
        },
    )
    live_table = client.get("/api/modernisation/league-table?mode=live")
    official_table = client.get("/api/modernisation/league-table?mode=official")

    assert snapshot_response.status_code == 200
    assert snapshot_response.json()["snapshot"]["player_scores"]
    assert finalised_response.status_code == 200
    assert finalised_response.json()["stable"] is True
    assert correction_response.status_code == 200
    assert correction_response.json()["audit_required"] is True
    assert live_table.status_code == 200
    assert live_table.json()["rows"][0]["movement"] == "up"
    assert official_table.json()["based_on_finalised_results"] is True
