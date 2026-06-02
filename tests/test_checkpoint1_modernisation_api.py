from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_checkpoint_one_lists_expected_features() -> None:
    client = TestClient(create_app())

    response = client.get("/api/modernisation/checkpoint-1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["checkpoint"] == 1
    assert {feature["issue"] for feature in payload["features"]} == {
        27,
        28,
        29,
        30,
        32,
        34,
    }


def test_league_status_and_rule_validation_contracts() -> None:
    client = TestClient(create_app())

    status_response = client.post(
        "/api/modernisation/league-seasons/season-2026/status",
        json={"status": "ready_for_draft", "changed_by": "commissioner"},
    )
    validation_response = client.post(
        "/api/modernisation/rule-versions/validate",
        json={
            "config_json": {
                "league": {"max_managers": 1},
                "draft": {"squad_size": 0},
            }
        },
    )

    assert status_response.status_code == 200
    assert status_response.json()["season"]["status"] == "ready_for_draft"
    assert validation_response.status_code == 200
    assert validation_response.json()["valid"] is False


def test_approval_correction_and_fpl_contracts() -> None:
    client = TestClient(create_app())

    approval_response = client.post(
        "/api/modernisation/approvals/approval-transfer-1/decision",
        json={
            "approver_role": "vice_commissioner",
            "approver_membership_id": "membership-vice",
            "decision": "approved",
        },
    )
    correction_response = client.post(
        "/api/modernisation/admin-corrections",
        json={
            "target_type": "fixture",
            "target_id": "fixture-1",
            "reason": "Correct fixture result.",
            "changes": {"home_score": {"before": 1, "after": 2}},
        },
    )
    first_refresh = client.post(
        "/api/modernisation/fpl/refresh",
        json={"endpoint_key": "fixtures"},
    )
    second_refresh = client.post(
        "/api/modernisation/fpl/refresh",
        json={"endpoint_key": "fixtures"},
    )

    assert approval_response.status_code == 200
    assert correction_response.status_code == 200
    assert first_refresh.status_code == 200
    assert second_refresh.status_code == 200
    assert first_refresh.json()["source"]["response_hash"] != second_refresh.json()["source"]["response_hash"]


def test_draft_and_squad_right_contracts() -> None:
    client = TestClient(create_app())

    draft_response = client.post(
        "/api/modernisation/draft-room/picks",
        json={
            "season_team_id": "season-team-drafton",
            "fpl_player_id": "fpl-103",
            "actor_membership_id": "membership-commissioner",
            "source": "commissioner_on_behalf",
        },
    )
    controlled = client.get("/api/modernisation/squad/availability/fpl-101")
    reserved = client.get("/api/modernisation/squad/availability/fpl-104")
    activated = client.post("/api/modernisation/squad/temporary-rights/right-104/activate")

    assert draft_response.status_code == 200
    assert draft_response.json()["squad_assignment"]["start_reason"] == "draft_pick"
    assert controlled.json()["reason"] == "active_squad_assignment"
    assert reserved.json()["reason"] == "temporary_right_pending"
    assert activated.status_code == 200
