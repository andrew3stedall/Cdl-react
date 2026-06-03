from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_checkpoint_three_lists_expected_features() -> None:
    client = TestClient(create_app())

    response = client.get("/api/modernisation/checkpoint-3")

    assert response.status_code == 200
    payload = response.json()
    assert payload["checkpoint"] == 3
    assert {feature["issue"] for feature in payload["features"]} == {31, 33, 46}


def test_free_agency_draw_processes_privately_and_creates_expiring_rights() -> None:
    client = TestClient(create_app())

    manager_view = client.get(
        "/api/modernisation/free-agency/draws/draw-gw-3?season_team_id=season-team-castle"
    )
    processed = client.post("/api/modernisation/free-agency/draws/draw-gw-3/process")
    expired = client.post("/api/modernisation/free-agency/temporary-rights/expire")

    assert manager_view.status_code == 200
    assert list(manager_view.json()["preferences"].keys()) == ["season-team-castle"]
    assert processed.status_code == 200
    rights = processed.json()["temporary_rights"]
    assert {right["fpl_player_id"] for right in rights} == {"fpl-201", "fpl-203"}
    assert all(right["status"] == "pending" for right in rights)
    assert expired.status_code == 200
    assert all(right["status"] == "expired" for right in expired.json()["expired_rights"])


def test_transfer_negotiation_requires_approval_before_squad_effect() -> None:
    client = TestClient(create_app())

    created = client.post(
        "/api/modernisation/negotiations",
        json={
            "from_season_team_id": "season-team-castle",
            "to_season_team_id": "season-team-drafton",
            "offered_player_ids": ["fpl-301"],
            "requested_player_ids": ["fpl-401"],
            "visibility": "private",
        },
    )
    negotiation_id = created.json()["negotiation"]["id"]
    countered = client.post(
        f"/api/modernisation/negotiations/{negotiation_id}/counter",
        json={"offered_player_ids": ["fpl-301"], "requested_player_ids": ["fpl-402"]},
    )
    accepted = client.post(
        f"/api/modernisation/negotiations/{negotiation_id}/decision",
        json={"decision": "accepted", "actor_membership_id": "membership-drafton"},
    )
    approved = client.post(
        f"/api/modernisation/negotiations/{negotiation_id}/approve",
        json={"approver_role": "commissioner", "approver_membership_id": "membership-commissioner"},
    )

    assert created.status_code == 200
    assert created.json()["negotiation"]["approval_status"] == "not_required_until_agreed"
    assert countered.status_code == 200
    assert accepted.status_code == 200
    assert accepted.json()["negotiation"]["approval_status"] == "pending"
    assert accepted.json()["negotiation"]["squad_effect"] == "held_until_approval"
    assert approved.status_code == 200
    assert approved.json()["negotiation"]["approval_status"] == "approved"
    assert approved.json()["negotiation"]["squad_effect"] == "applied"


def test_loan_return_activity_visibility_and_notifications() -> None:
    client = TestClient(create_app())

    loan_return = client.post("/api/modernisation/loans/loan-1/return")
    reminder = client.post(
        "/api/modernisation/notifications/deadline-reminders",
        json={
            "manager_membership_id": "membership-castle",
            "deadline_id": "lineup-gw-3",
            "window": "24h",
        },
    )
    duplicate = client.post(
        "/api/modernisation/notifications/deadline-reminders",
        json={
            "manager_membership_id": "membership-castle",
            "deadline_id": "lineup-gw-3",
            "window": "24h",
        },
    )
    watchlist = client.post(
        "/api/modernisation/notifications/watchlist-alerts",
        json={
            "manager_membership_id": "membership-castle",
            "fpl_player_id": "fpl-501",
            "previous_status": "unavailable",
            "current_status": "available",
        },
    )
    public_activity = client.get("/api/modernisation/activity")
    notifications = client.get(
        "/api/modernisation/notifications?manager_membership_id=membership-castle"
    )

    assert loan_return.status_code == 200
    assert loan_return.json()["loan"]["status"] == "returned"
    assert reminder.status_code == 200
    assert reminder.json()["created"] is True
    assert duplicate.status_code == 200
    assert duplicate.json()["created"] is False
    assert duplicate.json()["reason"] == "duplicate_suppressed"
    assert watchlist.status_code == 200
    assert public_activity.status_code == 200
    assert all(event["visibility"] == "public" for event in public_activity.json()["events"])
    assert notifications.status_code == 200
    assert {item["kind"] for item in notifications.json()["notifications"]} >= {
        "deadline_reminder",
        "watchlist_status_changed",
    }
