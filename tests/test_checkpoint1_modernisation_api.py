from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_checkpoint_one_lists_all_checkpoint_features() -> None:
    client = TestClient(create_app())

    response = client.get("/api/modernisation/checkpoint-1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["checkpoint"] == 1
    assert {feature["issue"] for feature in payload["features"]} == {27, 28, 29, 30, 32, 34}


def test_league_setup_tracks_status_history_and_transition() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/modernisation/league-seasons/season-2026/status",
        json={"status": "ready_for_draft", "changed_by": "commissioner"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["season"]["status"] == "ready_for_draft"
    assert payload["status_history"][-1]["to_status"] == "ready_for_draft"


def test_rule_config_validation_and_editability_contracts() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/modernisation/rule-versions/validate",
        json={"config_json": {"league": {"max_managers": 1}, "draft": {"squad_size": 0}}},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["valid"] is False
    assert {issue["field"] for issue in payload["issues"]} == {
        "league.max_managers",
        "draft.squad_size",
    }
    assert "draft_live" in payload["editability_constraints"]["locked_after_statuses"]


def test_approval_routing_rejects_conflicts_and_accepts_vice_commissioner() -> None:
    client = TestClient(create_app())

    conflicted = client.post(
        "/api/modernisation/approvals/approval-transfer-1/decision",
        json={
            "approver_role": "commissioner",
            "approver_membership_id": "membership-commissioner",
            "decision": "approved",
        },
    )
    accepted = client.post(
        "/api/modernisation/approvals/approval-transfer-1/decision",
        json={
            "approver_role": "vice_commissioner",
            "approver_membership_id": "membership-vice",
            "decision": "approved",
        },
    )

    assert conflicted.status_code == 403
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "approved"
    assert accepted.json()["audit_event"]["action"] == "approval_decided"


def test_correction_requires_reason_and_appends_audit() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/modernisation/admin-corrections",
        json={
            "target_type": "fixture",
            "target_id": "fixture-1",
            "reason": "Correcting imported result.",
            "changes": {"home_score": {"before": 1, "after": 2}},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["admin_action"]["reason"] == "Correcting imported result."
    assert payload["audit_event"]["action"] == "admin_correction"


def test_fpl_refresh_changes_hash_and_exposes_freshness() -> None:
    client = TestClient(create_app())

    first = client.post("/api/modernisation/fpl/refresh", json={"endpoint_key": "fixtures"})
    second = client.post("/api/modernisation/fpl/refresh", json={"endpoint_key": "fixtures"})
    freshness = client.get("/api/modernisation/fpl/freshness")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["source"]["response_hash"] != second.json()["source"]["response_hash"]
    assert freshness.json()["sources"][0]["provider"] == "FPL"


def test_draft_pick_creates_assignment_and_commissioner_audit() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/modernisation/draft-room/picks",
        json={
            "season_team_id": "season-team-drafton",
            "fpl_player_id": "fpl-103",
            "actor_membership_id": "membership-commissioner",
            "source": "commissioner_on_behalf",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["pick"]["pick_source"] == "commissioner_on_behalf"
    assert payload["squad_assignment"]["start_reason"] == "draft_pick"
    assert payload["draft_room"]["events"][-1]["audit_event_id"]


def test_temporary_right_activation_and_availability_explanations() -> None:
    client = TestClient(create_app())

    controlled = client.get("/api/modernisation/squad/availability/fpl-101")
    reserved = client.get("/api/modernisation/squad/availability/fpl-104")
    activated = client.post("/api/modernisation/squad/temporary-rights/right-104/activate")

    assert controlled.json()["reason"] == "active_squad_assignment"
    assert reserved.json()["reason"] == "temporary_right_pending"
    assert activated.status_code == 200
    assert activated.json()["temporary_right"]["status"] == "activated"
