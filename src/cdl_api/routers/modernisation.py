"""Checkpoint 1 modernisation API contracts."""

from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from cdl_api.contracts.common import ErrorCode, ValidationErrorResponse, ValidationIssue

router = APIRouter(prefix="/modernisation", tags=["modernisation"])

STATUS_FLOW = ["setup", "inviting", "ready_for_draft", "draft_live", "draft_complete", "active", "complete", "archived"]
CHECKPOINT_FEATURES = [
    {"issue": 27, "key": "league-season-team-model"},
    {"issue": 28, "key": "league-configuration-and-rule-versioning"},
    {"issue": 29, "key": "permissions-approvals-and-admin-audit"},
    {"issue": 34, "key": "fpl-data-access-and-cache"},
    {"issue": 32, "key": "live-draft-room"},
    {"issue": 30, "key": "squad-rights-and-assignments"},
]

LEAGUE = {"id": "league-cdl", "name": "Castle Draft League", "default_manager_count": 8}
SEASON = {"id": "season-2026", "league_id": "league-cdl", "name": "2026/27", "status": "setup", "active_rule_version_id": "rule-version-2026-draft"}
TEAMS = [{"id": "team-castle", "league_id": "league-cdl", "name": "Castle FC"}, {"id": "team-drafton", "league_id": "league-cdl", "name": "Drafton Athletic"}]
SEASON_TEAMS = [{"id": "season-team-castle", "team_id": "team-castle", "manager_membership_id": "membership-castle"}, {"id": "season-team-drafton", "team_id": "team-drafton", "manager_membership_id": "membership-drafton"}]
MEMBERSHIPS = [{"id": "membership-commissioner", "role": "commissioner"}, {"id": "membership-vice", "role": "vice_commissioner"}, {"id": "membership-castle", "role": "manager"}, {"id": "membership-drafton", "role": "manager"}]
STATUS_HISTORY = [{"from_status": None, "to_status": "setup", "changed_by": "system"}]
RULE_VERSIONS = [{"id": "rule-version-2026-draft", "status": "draft", "version": 1, "config_json": {"league": {"max_managers": 8}, "draft": {"squad_size": 3}}}]
APPROVALS = [{"id": "approval-transfer-1", "status": "pending", "required_approver_role": "vice_commissioner", "basis": "commissioner_involved", "involved_membership_ids": ["membership-commissioner", "membership-castle"], "actual_approver_membership_id": None}]
AUDIT_EVENTS: list[dict[str, Any]] = []
FPL_CACHE: dict[str, dict[str, Any]] = {}
FPL_FETCH_COUNTER = 1
PLAYERS = [{"id": "fpl-101", "display_name": "Alex Keeper", "value": 5.0}, {"id": "fpl-102", "display_name": "Ben Defender", "value": 6.0}, {"id": "fpl-103", "display_name": "Casey Midfielder", "value": 7.5}, {"id": "fpl-104", "display_name": "Riley Forward", "value": 9.0}]
DRAFT_ROOM: dict[str, Any] = {"id": "draft-season-2026", "status": "live", "pick_order": ["season-team-drafton", "season-team-castle"], "current_pick_number": 1, "preselection_queue": {"season-team-drafton": ["fpl-103"]}, "picks": [], "events": []}
SQUAD_CAP = 3
ASSIGNMENTS = [{"id": "assignment-101", "season_team_id": "season-team-castle", "fpl_player_id": "fpl-101", "start_gameweek_id": "gw-1", "end_gameweek_id": None, "start_reason": "seeded_squad", "end_reason": None}, {"id": "assignment-102", "season_team_id": "season-team-castle", "fpl_player_id": "fpl-102", "start_gameweek_id": "gw-1", "end_gameweek_id": None, "start_reason": "seeded_squad", "end_reason": None}]
RIGHTS = [{"id": "right-104", "season_team_id": "season-team-castle", "fpl_player_id": "fpl-104", "gameweek_id": "gw-1", "status": "pending", "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat()}]


class StatusRequest(BaseModel):
    status: str
    changed_by: str = "commissioner"


class RuleValidationRequest(BaseModel):
    config_json: dict[str, Any] = Field(default_factory=dict)


class ApprovalDecisionRequest(BaseModel):
    approver_role: str
    approver_membership_id: str
    decision: str


class CorrectionRequest(BaseModel):
    target_type: str
    target_id: str
    reason: str = Field(min_length=1)
    changes: dict[str, Any]


class FplRefreshRequest(BaseModel):
    endpoint_key: str = "bootstrap-static"
    force: bool = False


class DraftPickRequest(BaseModel):
    season_team_id: str
    fpl_player_id: str
    actor_membership_id: str
    source: str = "manager_manual"


class PreselectionRequest(BaseModel):
    season_team_id: str
    fpl_player_ids: list[str]


class RemovePlayerRequest(BaseModel):
    season_team_id: str
    fpl_player_id: str
    gameweek_id: str = "gw-1"
    reason: str = "manager_removed"


def _err(code: ErrorCode, message: str, http_status: int) -> JSONResponse:
    return JSONResponse(status_code=http_status, content={"code": code, "message": message})


def _validation(message: str, field: str) -> JSONResponse:
    issue = ValidationIssue(field=field, message=message)
    body = ValidationErrorResponse(message=message, issues=[issue]).model_dump(mode="json")
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=body)


def _audit(action: str, target_type: str, target_id: str, reason: str | None = None) -> dict[str, Any]:
    event = {"id": f"audit-{uuid4().hex[:8]}", "action": action, "target_type": target_type, "target_id": target_id, "reason": reason, "created_at": datetime.now(UTC).isoformat()}
    AUDIT_EVENTS.append(event)
    return event


def _role(membership_id: str) -> str | None:
    member = next((item for item in MEMBERSHIPS if item["id"] == membership_id), None)
    return None if member is None else str(member["role"])


def _active(season_team_id: str | None = None) -> list[dict[str, Any]]:
    assignments = [item for item in ASSIGNMENTS if item["end_gameweek_id"] is None]
    return assignments if season_team_id is None else [item for item in assignments if item["season_team_id"] == season_team_id]


def _hash(payload: dict[str, Any]) -> str:
    return sha256(str(sorted(payload.items())).encode()).hexdigest()


@router.get("/checkpoint-1", response_model=None)
def checkpoint_one() -> dict[str, Any]:
    return {"checkpoint": 1, "features": CHECKPOINT_FEATURES, "status": "implemented"}


@router.get("/league-setup", response_model=None)
def league_setup() -> dict[str, Any]:
    return {"league": LEAGUE, "season": SEASON, "teams": TEAMS, "season_teams": SEASON_TEAMS, "memberships": MEMBERSHIPS, "status_flow": STATUS_FLOW, "status_history": STATUS_HISTORY}


@router.post("/league-seasons/{season_id}/status", response_model=None)
def update_status(season_id: str, payload: StatusRequest) -> dict[str, Any] | JSONResponse:
    if season_id != SEASON["id"]:
        return _err(ErrorCode.NOT_FOUND, "League season not found.", status.HTTP_404_NOT_FOUND)
    if payload.status not in STATUS_FLOW:
        return _validation("Unknown season status.", "status")
    previous = SEASON["status"]
    SEASON["status"] = payload.status
    STATUS_HISTORY.append({"season_id": season_id, "from_status": previous, "to_status": payload.status, "changed_by": payload.changed_by})
    return league_setup()


@router.get("/rule-versions", response_model=None)
def rule_versions() -> dict[str, Any]:
    domains = ["league", "season", "draft", "free_agency", "transfers", "loans", "lineups", "scoring", "chips", "knockout"]
    return {"season_id": SEASON["id"], "domains": domains, "versions": RULE_VERSIONS, "active_rule_version_id": SEASON["active_rule_version_id"]}


@router.post("/rule-versions/validate", response_model=None)
def validate_rules(payload: RuleValidationRequest) -> dict[str, Any]:
    league = payload.config_json.get("league", {})
    draft = payload.config_json.get("draft", {})
    issues = []
    if isinstance(league, dict) and int(league.get("max_managers", 8)) < 2:
        issues.append({"field": "league.max_managers", "message": "At least two managers are required."})
    if isinstance(draft, dict) and int(draft.get("squad_size", 3)) < 1:
        issues.append({"field": "draft.squad_size", "message": "Squad size must be positive."})
    return {"valid": not issues, "issues": issues, "rule_version_reference": SEASON["active_rule_version_id"], "editability_constraints": {"locked_after_statuses": ["draft_live", "active", "complete", "archived"]}}


@router.get("/approvals", response_model=None)
def approvals() -> dict[str, Any]:
    return {"approvals": APPROVALS, "routing": "commissioner_involved -> vice_commissioner"}


@router.post("/approvals/{approval_id}/decision", response_model=None)
def decide_approval(approval_id: str, payload: ApprovalDecisionRequest) -> dict[str, Any] | JSONResponse:
    approval = next((item for item in APPROVALS if item["id"] == approval_id), None)
    if approval is None:
        return _err(ErrorCode.NOT_FOUND, "Approval not found.", status.HTTP_404_NOT_FOUND)
    if _role(payload.approver_membership_id) != payload.approver_role or payload.approver_role != approval["required_approver_role"]:
        return _err(ErrorCode.FORBIDDEN, "Approver role cannot decide this request.", status.HTTP_403_FORBIDDEN)
    if payload.approver_membership_id in approval["involved_membership_ids"]:
        return _err(ErrorCode.FORBIDDEN, "Approver is conflicted on this request.", status.HTTP_403_FORBIDDEN)
    approval["status"] = payload.decision
    approval["actual_approver_membership_id"] = payload.approver_membership_id
    approval["audit_event"] = _audit("approval_decided", "approval", approval_id)
    return approval


@router.post("/admin-corrections", response_model=None)
def create_correction(payload: CorrectionRequest) -> dict[str, Any] | JSONResponse:
    if not payload.reason.strip():
        return _validation("Correction reason is required.", "reason")
    action = {"id": f"admin-action-{uuid4().hex[:8]}", "target_type": payload.target_type, "target_id": payload.target_id, "reason": payload.reason, "changes": payload.changes}
    return {"admin_action": action, "audit_event": _audit("admin_correction", payload.target_type, payload.target_id, payload.reason)}


@router.get("/audit-events", response_model=None)
def audit_events() -> dict[str, Any]:
    return {"events": AUDIT_EVENTS}


@router.get("/fpl/freshness", response_model=None)
def fpl_freshness() -> dict[str, Any]:
    if not FPL_CACHE:
        refresh_fpl(FplRefreshRequest(endpoint_key="bootstrap-static", force=True))
    return {"sources": list(FPL_CACHE.values())}


@router.post("/fpl/refresh", response_model=None)
def refresh_fpl(payload: FplRefreshRequest) -> dict[str, Any]:
    global FPL_FETCH_COUNTER
    raw = {"endpoint_key": payload.endpoint_key, "sequence": FPL_FETCH_COUNTER}
    FPL_FETCH_COUNTER += 1
    source = {"provider": "FPL", "endpoint_key": payload.endpoint_key, "status": "fresh", "response_hash": _hash(raw), "fetched_at": datetime.now(UTC).isoformat(), "ttl_seconds": 3600, "force_refresh": payload.force}
    FPL_CACHE[payload.endpoint_key] = source
    return {"source": source, "fetch_log": _audit("fpl_fetch", "external_payload_cache", payload.endpoint_key)}


@router.get("/draft-room", response_model=None)
def draft_room() -> dict[str, Any]:
    index = min(DRAFT_ROOM["current_pick_number"] - 1, len(DRAFT_ROOM["pick_order"]) - 1)
    picked = {pick["fpl_player_id"] for pick in DRAFT_ROOM["picks"]}
    available = [player for player in PLAYERS if player["id"] not in picked and not any(item["fpl_player_id"] == player["id"] for item in _active())]
    return {**DRAFT_ROOM, "current_season_team_id": DRAFT_ROOM["pick_order"][index], "available_players": available}


@router.put("/draft-room/preselection", response_model=None)
def update_preselection(payload: PreselectionRequest) -> dict[str, Any]:
    DRAFT_ROOM["preselection_queue"][payload.season_team_id] = payload.fpl_player_ids
    return draft_room()


def _pick(payload: DraftPickRequest) -> dict[str, Any] | JSONResponse:
    current = draft_room()["current_season_team_id"]
    if payload.season_team_id != current and _role(payload.actor_membership_id) != "commissioner":
        return _err(ErrorCode.FORBIDDEN, "Only the current manager can pick.", status.HTTP_403_FORBIDDEN)
    if any(item["fpl_player_id"] == payload.fpl_player_id for item in _active()):
        return _err(ErrorCode.CONFLICT, "Player is already controlled.", status.HTTP_409_CONFLICT)
    pick = {"id": f"pick-{uuid4().hex[:8]}", "pick_number": DRAFT_ROOM["current_pick_number"], "season_team_id": payload.season_team_id, "fpl_player_id": payload.fpl_player_id, "pick_source": payload.source, "seconds_taken": 24}
    DRAFT_ROOM["picks"].append(pick)
    DRAFT_ROOM["current_pick_number"] += 1
    assignment = {"id": f"assignment-{uuid4().hex[:8]}", "season_team_id": payload.season_team_id, "fpl_player_id": payload.fpl_player_id, "start_gameweek_id": "gw-1", "end_gameweek_id": None, "start_reason": "draft_pick", "end_reason": None}
    ASSIGNMENTS.append(assignment)
    event = {"type": "draft_pick", "public": True, "pick_id": pick["id"]}
    if payload.source == "commissioner_on_behalf":
        event["audit_event_id"] = _audit("commissioner_pick_on_behalf", "draft_pick", pick["id"])["id"]
    DRAFT_ROOM["events"].append(event)
    return {"pick": pick, "squad_assignment": assignment, "draft_room": draft_room()}


@router.post("/draft-room/picks", response_model=None)
def make_pick(payload: DraftPickRequest) -> dict[str, Any] | JSONResponse:
    return _pick(payload)


@router.post("/draft-room/autopick", response_model=None)
def autopick() -> dict[str, Any] | JSONResponse:
    room = draft_room()
    team_id = room["current_season_team_id"]
    available = {player["id"] for player in room["available_players"]}
    queue = [player_id for player_id in DRAFT_ROOM["preselection_queue"].get(team_id, []) if player_id in available]
    player_id = queue[0] if queue else max(room["available_players"], key=lambda player: player["value"])["id"]
    source = "manager_preselection_auto" if queue else "system_timeout_auto"
    return _pick(DraftPickRequest(season_team_id=team_id, fpl_player_id=player_id, actor_membership_id="system", source=source))


@router.get("/squad/active", response_model=None)
def active_squad(season_team_id: str = "season-team-castle") -> dict[str, Any]:
    assignments = _active(season_team_id)
    return {"season_team_id": season_team_id, "assignments": assignments, "empty_slots": max(SQUAD_CAP - len(assignments), 0), "temporary_rights": [right for right in RIGHTS if right["season_team_id"] == season_team_id and right["status"] == "pending"]}


@router.get("/squad/history", response_model=None)
def squad_history(season_team_id: str = "season-team-castle") -> dict[str, Any]:
    return {"season_team_id": season_team_id, "assignments": [item for item in ASSIGNMENTS if item["season_team_id"] == season_team_id]}


@router.post("/squad/temporary-rights/{right_id}/activate", response_model=None)
def activate_right(right_id: str) -> dict[str, Any] | JSONResponse:
    right = next((item for item in RIGHTS if item["id"] == right_id), None)
    if right is None:
        return _err(ErrorCode.NOT_FOUND, "Temporary right not found.", status.HTTP_404_NOT_FOUND)
    if len(_active(str(right["season_team_id"]))) >= SQUAD_CAP:
        return _err(ErrorCode.CONFLICT, "Squad has no empty slots.", status.HTTP_409_CONFLICT)
    right["status"] = "activated"
    assignment = {"id": f"assignment-{uuid4().hex[:8]}", "season_team_id": right["season_team_id"], "fpl_player_id": right["fpl_player_id"], "start_gameweek_id": right["gameweek_id"], "end_gameweek_id": None, "start_reason": "temporary_right_activation", "end_reason": None}
    ASSIGNMENTS.append(assignment)
    return {"temporary_right": right, "squad_assignment": assignment, "active_squad": active_squad(str(right["season_team_id"]))}


@router.post("/squad/remove-player", response_model=None)
def remove_player(payload: RemovePlayerRequest) -> dict[str, Any] | JSONResponse:
    assignment = next((item for item in ASSIGNMENTS if item["season_team_id"] == payload.season_team_id and item["fpl_player_id"] == payload.fpl_player_id and item["end_gameweek_id"] is None), None)
    if assignment is None:
        return _err(ErrorCode.NOT_FOUND, "Active squad assignment not found.", status.HTTP_404_NOT_FOUND)
    assignment["end_gameweek_id"] = payload.gameweek_id
    assignment["end_reason"] = payload.reason
    return {"assignment": assignment, "squad_action": _audit("squad_player_removed", "squad_assignment", str(assignment["id"]), payload.reason)}


@router.get("/squad/availability/{fpl_player_id}", response_model=None)
def player_availability(fpl_player_id: str) -> dict[str, Any]:
    assignment = next((item for item in _active() if item["fpl_player_id"] == fpl_player_id), None)
    if assignment is not None:
        return {"fpl_player_id": fpl_player_id, "available": False, "reason": "active_squad_assignment", "controlled_by_season_team_id": assignment["season_team_id"]}
    right = next((item for item in RIGHTS if item["fpl_player_id"] == fpl_player_id and item["status"] == "pending"), None)
    if right is not None:
        return {"fpl_player_id": fpl_player_id, "available": False, "reason": "temporary_right_pending", "controlled_by_season_team_id": right["season_team_id"]}
    return {"fpl_player_id": fpl_player_id, "available": True, "reason": "free_agent"}
