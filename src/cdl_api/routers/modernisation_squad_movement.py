"""Checkpoint 3 modernisation API contracts for squad movement."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from cdl_api.contracts.common import ErrorCode, ValidationErrorResponse, ValidationIssue

router = APIRouter(prefix="/modernisation", tags=["modernisation"])

CHECKPOINT_FEATURES = [
    {"issue": 33, "key": "free-agency-draws"},
    {"issue": 31, "key": "transfers-loans-and-negotiations"},
    {"issue": 46, "key": "notifications-activity-and-deadline-service"},
]

DEADLINES = {
    "free-agency-gw-3": {
        "id": "free-agency-gw-3",
        "kind": "free_agency_draw",
        "route": "/squad-management/free-agency",
        "due_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
    },
    "lineup-gw-3": {
        "id": "lineup-gw-3",
        "kind": "lineup_lock",
        "route": "/team-selection",
        "due_at": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
    },
}
ACTIVITY: list[dict[str, Any]] = []
NOTIFICATIONS: list[dict[str, Any]] = []
REMINDERS_SENT: set[tuple[str, str, str]] = set()

FREE_AGENCY_DRAW = {
    "id": "draw-gw-3",
    "status": "pending",
    "gameweek_id": "gw-3",
    "draw_order": ["season-team-drafton", "season-team-castle"],
    "preferences": {
        "season-team-drafton": ["fpl-201", "fpl-202"],
        "season-team-castle": ["fpl-201", "fpl-203"],
    },
    "processed_results": [],
}
TEMPORARY_RIGHTS: list[dict[str, Any]] = []
NEGOTIATIONS: dict[str, dict[str, Any]] = {}
LOANS: dict[str, dict[str, Any]] = {
    "loan-1": {
        "id": "loan-1",
        "player_id": "fpl-301",
        "from_season_team_id": "season-team-castle",
        "to_season_team_id": "season-team-drafton",
        "status": "active",
        "return_gameweek_id": "gw-5",
    }
}


class NegotiationPayload(BaseModel):
    from_season_team_id: str
    to_season_team_id: str
    offered_player_ids: list[str]
    requested_player_ids: list[str]
    visibility: str = "private"


class CounterPayload(BaseModel):
    offered_player_ids: list[str]
    requested_player_ids: list[str]


class DecisionPayload(BaseModel):
    decision: str = Field(pattern="^(accepted|rejected)$")
    actor_membership_id: str = "membership-manager"


class ApprovalPayload(BaseModel):
    approver_role: str = "commissioner"
    approver_membership_id: str = "membership-commissioner"


class ReminderPayload(BaseModel):
    manager_membership_id: str
    deadline_id: str
    window: str = "24h"


class WatchlistPayload(BaseModel):
    manager_membership_id: str
    fpl_player_id: str
    previous_status: str
    current_status: str


def _err(code: ErrorCode, message: str, http_status: int) -> JSONResponse:
    return JSONResponse(status_code=http_status, content={"code": code, "message": message})


def _validation(message: str, field: str) -> JSONResponse:
    issue = ValidationIssue(field=field, message=message)
    body = ValidationErrorResponse(message=message, issues=[issue]).model_dump(mode="json")
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=body)


def _event(kind: str, route: str, visibility: str, subject_id: str) -> dict[str, Any]:
    event = {
        "id": f"activity-{uuid4().hex[:8]}",
        "kind": kind,
        "route": route,
        "visibility": visibility,
        "subject_id": subject_id,
        "created_at": datetime.now(UTC).isoformat(),
    }
    ACTIVITY.append(event)
    return event


def _notify(manager_membership_id: str, kind: str, route: str, subject_id: str) -> dict[str, Any]:
    notification = {
        "id": f"notification-{uuid4().hex[:8]}",
        "manager_membership_id": manager_membership_id,
        "kind": kind,
        "route": route,
        "subject_id": subject_id,
        "read": False,
        "created_at": datetime.now(UTC).isoformat(),
    }
    NOTIFICATIONS.append(notification)
    return notification


@router.get("/checkpoint-3", response_model=None)
def checkpoint_three() -> dict[str, Any]:
    return {"checkpoint": 3, "features": CHECKPOINT_FEATURES, "status": "implemented"}


@router.get("/free-agency/draws/{draw_id}", response_model=None)
def get_free_agency_draw(draw_id: str, season_team_id: str | None = None) -> dict[str, Any] | JSONResponse:
    if draw_id != FREE_AGENCY_DRAW["id"]:
        return _err(ErrorCode.NOT_FOUND, "Free agency draw not found.", status.HTTP_404_NOT_FOUND)
    preferences = FREE_AGENCY_DRAW["preferences"]
    if season_team_id is not None:
        preferences = {season_team_id: preferences.get(season_team_id, [])}
    return {**FREE_AGENCY_DRAW, "preferences": preferences}


@router.post("/free-agency/draws/{draw_id}/process", response_model=None)
def process_free_agency_draw(draw_id: str) -> dict[str, Any] | JSONResponse:
    if draw_id != FREE_AGENCY_DRAW["id"]:
        return _err(ErrorCode.NOT_FOUND, "Free agency draw not found.", status.HTTP_404_NOT_FOUND)
    claimed: set[str] = set()
    results = []
    for season_team_id in FREE_AGENCY_DRAW["draw_order"]:
        awarded_player_id = next(
            player_id
            for player_id in FREE_AGENCY_DRAW["preferences"][season_team_id]
            if player_id not in claimed
        )
        claimed.add(awarded_player_id)
        right = {
            "id": f"right-{uuid4().hex[:8]}",
            "season_team_id": season_team_id,
            "fpl_player_id": awarded_player_id,
            "status": "pending",
            "expires_at": DEADLINES["free-agency-gw-3"]["due_at"],
        }
        TEMPORARY_RIGHTS.append(right)
        results.append({"season_team_id": season_team_id, "temporary_right": right})
    FREE_AGENCY_DRAW["status"] = "processed"
    FREE_AGENCY_DRAW["processed_results"] = results
    _event("free_agency_draw_processed", "/squad-management/free-agency", "public", draw_id)
    return {"draw": FREE_AGENCY_DRAW, "temporary_rights": TEMPORARY_RIGHTS}


@router.post("/free-agency/temporary-rights/expire", response_model=None)
def expire_temporary_rights(deadline_id: str = "free-agency-gw-3") -> dict[str, Any]:
    expired = []
    for right in TEMPORARY_RIGHTS:
        if right["status"] == "pending" and right["expires_at"] == DEADLINES[deadline_id]["due_at"]:
            right["status"] = "expired"
            expired.append(right)
    return {"expired_rights": expired}


@router.post("/negotiations", response_model=None)
def create_negotiation(payload: NegotiationPayload) -> dict[str, Any]:
    negotiation = {
        "id": f"negotiation-{uuid4().hex[:8]}",
        "status": "offered",
        "approval_status": "not_required_until_agreed",
        **payload.model_dump(),
        "events": [],
    }
    NEGOTIATIONS[negotiation["id"]] = negotiation
    event = _event("trade_offer_created", "/squad-management/transfers", "private", negotiation["id"])
    negotiation["events"].append(event)
    _notify("membership-drafton", "trade_offer", event["route"], negotiation["id"])
    return {"negotiation": negotiation}


@router.post("/negotiations/{negotiation_id}/counter", response_model=None)
def counter_negotiation(negotiation_id: str, payload: CounterPayload) -> dict[str, Any] | JSONResponse:
    negotiation = NEGOTIATIONS.get(negotiation_id)
    if negotiation is None:
        return _err(ErrorCode.NOT_FOUND, "Negotiation not found.", status.HTTP_404_NOT_FOUND)
    negotiation["status"] = "countered"
    negotiation["offered_player_ids"] = payload.offered_player_ids
    negotiation["requested_player_ids"] = payload.requested_player_ids
    negotiation["events"].append(
        _event("trade_countered", "/squad-management/transfers", "private", negotiation_id)
    )
    return {"negotiation": negotiation}


@router.post("/negotiations/{negotiation_id}/decision", response_model=None)
def decide_negotiation(negotiation_id: str, payload: DecisionPayload) -> dict[str, Any] | JSONResponse:
    negotiation = NEGOTIATIONS.get(negotiation_id)
    if negotiation is None:
        return _err(ErrorCode.NOT_FOUND, "Negotiation not found.", status.HTTP_404_NOT_FOUND)
    negotiation["status"] = payload.decision
    if payload.decision == "accepted":
        negotiation["approval_status"] = "pending"
        negotiation["squad_effect"] = "held_until_approval"
    negotiation["events"].append(
        _event("trade_decided", "/squad-management/transfers", "private", negotiation_id)
    )
    return {"negotiation": negotiation}


@router.post("/negotiations/{negotiation_id}/approve", response_model=None)
def approve_negotiation(negotiation_id: str, payload: ApprovalPayload) -> dict[str, Any] | JSONResponse:
    negotiation = NEGOTIATIONS.get(negotiation_id)
    if negotiation is None:
        return _err(ErrorCode.NOT_FOUND, "Negotiation not found.", status.HTTP_404_NOT_FOUND)
    if negotiation["status"] != "accepted":
        return _err(ErrorCode.CONFLICT, "Only accepted negotiations can be approved.", status.HTTP_409_CONFLICT)
    negotiation["approval_status"] = "approved"
    negotiation["approved_by_role"] = payload.approver_role
    negotiation["squad_effect"] = "applied"
    event = _event("trade_approved", "/squad-management/transfers", "public", negotiation_id)
    _notify("membership-castle", "trade_approved", event["route"], negotiation_id)
    _notify("membership-drafton", "trade_approved", event["route"], negotiation_id)
    return {"negotiation": negotiation, "activity_event": event}


@router.post("/loans/{loan_id}/return", response_model=None)
def return_loan(loan_id: str) -> dict[str, Any] | JSONResponse:
    loan = LOANS.get(loan_id)
    if loan is None:
        return _err(ErrorCode.NOT_FOUND, "Loan not found.", status.HTTP_404_NOT_FOUND)
    loan["status"] = "returned"
    loan["returned_at"] = datetime.now(UTC).isoformat()
    event = _event("loan_returned", "/squad-management/transfers", "public", loan_id)
    return {"loan": loan, "activity_event": event}


@router.get("/activity", response_model=None)
def activity_feed(include_private: bool = False) -> dict[str, Any]:
    events = ACTIVITY if include_private else [event for event in ACTIVITY if event["visibility"] == "public"]
    return {"events": events}


@router.get("/notifications", response_model=None)
def notification_centre(manager_membership_id: str = "membership-castle") -> dict[str, Any]:
    return {
        "notifications": [
            item for item in NOTIFICATIONS if item["manager_membership_id"] == manager_membership_id
        ],
        "preferences": {"deadline_reminders": True, "watchlist_alerts": True},
    }


@router.post("/notifications/deadline-reminders", response_model=None)
def send_deadline_reminder(payload: ReminderPayload) -> dict[str, Any] | JSONResponse:
    deadline = DEADLINES.get(payload.deadline_id)
    if deadline is None:
        return _err(ErrorCode.NOT_FOUND, "Deadline not found.", status.HTTP_404_NOT_FOUND)
    key = (payload.manager_membership_id, payload.deadline_id, payload.window)
    if key in REMINDERS_SENT:
        return {"created": False, "reason": "duplicate_suppressed"}
    REMINDERS_SENT.add(key)
    notification = _notify(
        payload.manager_membership_id,
        "deadline_reminder",
        str(deadline["route"]),
        payload.deadline_id,
    )
    return {"created": True, "notification": notification}


@router.post("/notifications/watchlist-alerts", response_model=None)
def send_watchlist_alert(payload: WatchlistPayload) -> dict[str, Any]:
    notification = _notify(
        payload.manager_membership_id,
        "watchlist_status_changed",
        "/scouting/watchlist",
        payload.fpl_player_id,
    )
    return {
        "notification": notification,
        "status_change": {
            "previous_status": payload.previous_status,
            "current_status": payload.current_status,
        },
    }
