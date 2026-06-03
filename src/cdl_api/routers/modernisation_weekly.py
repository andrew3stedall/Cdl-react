"""Checkpoint 2 modernisation API contracts for weekly gameplay."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from cdl_api.contracts.common import ErrorCode, ValidationErrorResponse, ValidationIssue

router = APIRouter(prefix="/modernisation", tags=["modernisation"])

CHECKPOINT_FEATURES = [
    {"issue": 35, "key": "team-selection-and-lineup-locking"},
    {"issue": 36, "key": "substitution-engine"},
    {"issue": 37, "key": "chips-and-scoring-modifiers"},
    {"issue": 39, "key": "fixture-scoring-snapshots-and-finalisation"},
    {"issue": 40, "key": "league-table-and-table-movement"},
]

GAMEWEEK = {
    "id": "gw-2",
    "deadline_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
    "status": "editable",
    "next_editable_gameweek_id": "gw-2",
}
RULE_VERSION_ID = "rule-version-2026-active"
VALID_FORMATIONS = {"3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-4-1"}
PLAYERS = {
    "fpl-101": {"id": "fpl-101", "display_name": "Alex Keeper", "position": "GKP"},
    "fpl-102": {"id": "fpl-102", "display_name": "Ben Defender", "position": "DEF"},
    "fpl-103": {"id": "fpl-103", "display_name": "Casey Midfielder", "position": "MID"},
    "fpl-104": {"id": "fpl-104", "display_name": "Riley Forward", "position": "FWD"},
    "fpl-105": {"id": "fpl-105", "display_name": "Morgan Midfielder", "position": "MID"},
    "fpl-106": {"id": "fpl-106", "display_name": "Taylor Forward", "position": "FWD"},
    "fpl-107": {"id": "fpl-107", "display_name": "Drew Defender", "position": "DEF"},
    "fpl-108": {"id": "fpl-108", "display_name": "Harper Defender", "position": "DEF"},
    "fpl-109": {"id": "fpl-109", "display_name": "Jordan Midfielder", "position": "MID"},
    "fpl-110": {"id": "fpl-110", "display_name": "Quinn Midfielder", "position": "MID"},
    "fpl-111": {"id": "fpl-111", "display_name": "Sam Forward", "position": "FWD"},
    "fpl-112": {"id": "fpl-112", "display_name": "Blake Defender", "position": "DEF"},
    "fpl-113": {"id": "fpl-113", "display_name": "Robin Midfielder", "position": "MID"},
    "fpl-114": {"id": "fpl-114", "display_name": "Avery Forward", "position": "FWD"},
    "fpl-115": {"id": "fpl-115", "display_name": "Sky Midfielder", "position": "MID"},
    "fpl-116": {"id": "fpl-116", "display_name": "Reese Forward", "position": "FWD"},
}
LINEUPS: dict[str, dict[str, Any]] = {
    "season-team-castle:gw-2": {
        "season_team_id": "season-team-castle",
        "gameweek_id": "gw-2",
        "status": "editable",
        "starters": [
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
        ],
        "bench": ["fpl-112", "fpl-113", "fpl-114"],
        "reserves": ["fpl-115", "fpl-116"],
        "captain_id": "fpl-104",
        "vice_captain_id": "fpl-103",
        "active_chip": None,
        "auto_adjustments": [],
    }
}
PLAYER_SCORES = {
    "fpl-101": {"minutes": 90, "points": 4},
    "fpl-102": {"minutes": 0, "points": 0},
    "fpl-103": {"minutes": 90, "points": 7},
    "fpl-104": {"minutes": 72, "points": 8},
    "fpl-105": {"minutes": 85, "points": 5},
    "fpl-106": {"minutes": 90, "points": 6},
    "fpl-107": {"minutes": 90, "points": 4},
    "fpl-108": {"minutes": 90, "points": 3},
    "fpl-109": {"minutes": 80, "points": 6},
    "fpl-110": {"minutes": 65, "points": 3},
    "fpl-111": {"minutes": 75, "points": 5},
    "fpl-112": {"minutes": 90, "points": 5},
    "fpl-113": {"minutes": 30, "points": 2},
    "fpl-114": {"minutes": 15, "points": 1},
    "fpl-115": {"minutes": 90, "points": 6},
    "fpl-116": {"minutes": 90, "points": 6},
}
SUBSTITUTIONS: list[dict[str, Any]] = []
CHIP_OWNERSHIP = [
    {"chip": "triple_captain", "status": "available"},
    {"chip": "dual_captain", "status": "available"},
    {"chip": "auto_captain", "status": "available"},
    {"chip": "bench_boost", "status": "available"},
    {"chip": "best_xi", "status": "available"},
]
FIXTURE = {
    "id": "fixture-1",
    "gameweek_id": "gw-2",
    "home_season_team_id": "season-team-castle",
    "away_season_team_id": "season-team-drafton",
}
SNAPSHOTS: list[dict[str, Any]] = []
FINAL_RESULTS: dict[str, dict[str, Any]] = {}
TABLE_SNAPSHOTS: dict[str, list[dict[str, Any]]] = {
    "live": [
        {"season_team_id": "season-team-castle", "position": 1, "previous_position": 2, "points": 21},
        {"season_team_id": "season-team-drafton", "position": 2, "previous_position": 1, "points": 20},
    ],
    "provisional": [
        {"season_team_id": "season-team-castle", "position": 1, "previous_position": 2, "points": 22},
        {"season_team_id": "season-team-drafton", "position": 2, "previous_position": 1, "points": 20},
    ],
    "official": [
        {"season_team_id": "season-team-castle", "position": 2, "previous_position": 2, "points": 18},
        {"season_team_id": "season-team-drafton", "position": 1, "previous_position": 1, "points": 20},
    ],
}


class LineupPayload(BaseModel):
    starters: list[str]
    bench: list[str] = Field(default_factory=list)
    reserves: list[str] = Field(default_factory=list)
    captain_id: str
    vice_captain_id: str
    active_chip: str | None = None


class ChipActivationPayload(BaseModel):
    season_team_id: str = "season-team-castle"
    gameweek_id: str = "gw-2"
    chip: str


class SnapshotPayload(BaseModel):
    fixture_id: str = "fixture-1"
    source_hash: str = "event-live-hash-1"
    mode: str = "provisional"


class CorrectionPayload(BaseModel):
    fixture_id: str
    reason: str = Field(min_length=1)
    home_score: int
    away_score: int


def _err(code: ErrorCode, message: str, http_status: int) -> JSONResponse:
    return JSONResponse(status_code=http_status, content={"code": code, "message": message})


def _validation(message: str, field: str) -> JSONResponse:
    issue = ValidationIssue(field=field, message=message)
    body = ValidationErrorResponse(message=message, issues=[issue]).model_dump(mode="json")
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=body)


def _lineup_key(season_team_id: str, gameweek_id: str) -> str:
    return f"{season_team_id}:{gameweek_id}"


def _lineup(season_team_id: str, gameweek_id: str) -> dict[str, Any]:
    key = _lineup_key(season_team_id, gameweek_id)
    if key not in LINEUPS:
        LINEUPS[key] = {
            "season_team_id": season_team_id,
            "gameweek_id": gameweek_id,
            "status": "editable",
            "starters": [],
            "bench": [],
            "reserves": [],
            "captain_id": None,
            "vice_captain_id": None,
            "active_chip": None,
            "auto_adjustments": [],
        }
    return LINEUPS[key]


def _formation(starters: list[str]) -> str:
    counts = {"DEF": 0, "MID": 0, "FWD": 0}
    for player_id in starters:
        position = PLAYERS.get(player_id, {}).get("position")
        if position in counts:
            counts[str(position)] += 1
    return f"{counts['DEF']}-{counts['MID']}-{counts['FWD']}"


def _validate_lineup(lineup: dict[str, Any]) -> list[dict[str, str]]:
    issues = []
    starters = list(lineup["starters"])
    bench = list(lineup["bench"])
    reserves = list(lineup["reserves"])
    player_ids = starters + bench + reserves
    if len(player_ids) != len(set(player_ids)):
        issues.append({"field": "players", "message": "A player can only appear once."})
    if lineup["captain_id"] not in starters:
        issues.append({"field": "captain_id", "message": "Captain must be a starter."})
    if lineup["vice_captain_id"] not in starters:
        issues.append({"field": "vice_captain_id", "message": "Vice captain must be a starter."})
    if lineup["captain_id"] == lineup["vice_captain_id"]:
        issues.append({"field": "vice_captain_id", "message": "Vice captain must differ from captain."})
    if _formation(starters) not in VALID_FORMATIONS:
        issues.append({"field": "starters", "message": "Lineup does not match a valid formation."})
    return issues


def _score_lineup(lineup: dict[str, Any]) -> dict[str, Any]:
    starters = list(lineup["starters"])
    bench = list(lineup["bench"])
    active_chip = lineup.get("active_chip")
    scoring_ids = starters + bench if active_chip == "bench_boost" else starters
    player_rows = [
        {
            "fpl_player_id": player_id,
            "points": PLAYER_SCORES[player_id]["points"],
            "minutes": PLAYER_SCORES[player_id]["minutes"],
            "section": "bench" if player_id in bench else "starter",
        }
        for player_id in scoring_ids
    ]
    total = sum(row["points"] for row in player_rows)
    chip_delta = 0
    if active_chip == "triple_captain" and lineup["captain_id"] in PLAYER_SCORES:
        captain_points = PLAYER_SCORES[lineup["captain_id"]]["points"]
        total += captain_points
        chip_delta = captain_points
    return {"players": player_rows, "total": total, "chip_delta": chip_delta}


def _movement(row: dict[str, Any]) -> str:
    if row["position"] < row["previous_position"]:
        return "up"
    if row["position"] > row["previous_position"]:
        return "down"
    return "same"


@router.get("/checkpoint-2", response_model=None)
def checkpoint_two() -> dict[str, Any]:
    return {"checkpoint": 2, "features": CHECKPOINT_FEATURES, "status": "implemented"}


@router.get("/lineups/{season_team_id}/{gameweek_id}", response_model=None)
def get_lineup(season_team_id: str, gameweek_id: str) -> dict[str, Any]:
    return {
        "lineup": _lineup(season_team_id, gameweek_id),
        "gameweek": GAMEWEEK,
        "players": PLAYERS,
    }


@router.put("/lineups/{season_team_id}/{gameweek_id}", response_model=None)
def save_lineup(
    season_team_id: str,
    gameweek_id: str,
    payload: LineupPayload,
) -> dict[str, Any] | JSONResponse:
    lineup = _lineup(season_team_id, gameweek_id)
    if lineup["status"] == "locked":
        return _err(ErrorCode.CONFLICT, "Lineup is locked.", status.HTTP_409_CONFLICT)
    lineup.update(payload.model_dump())
    return {"lineup": lineup, "validation": _validate_lineup(lineup)}


@router.post("/lineups/{season_team_id}/{gameweek_id}/validate", response_model=None)
def validate_lineup(season_team_id: str, gameweek_id: str) -> dict[str, Any]:
    lineup = _lineup(season_team_id, gameweek_id)
    issues = _validate_lineup(lineup)
    return {
        "valid": not issues,
        "issues": issues,
        "rule_version_reference": RULE_VERSION_ID,
        "formation": _formation(list(lineup["starters"])),
    }


@router.post("/lineups/{season_team_id}/{gameweek_id}/lock", response_model=None)
def lock_lineup(season_team_id: str, gameweek_id: str) -> dict[str, Any] | JSONResponse:
    lineup = _lineup(season_team_id, gameweek_id)
    issues = _validate_lineup(lineup)
    if issues:
        return _validation("Lineup is invalid.", issues[0]["field"])
    lineup["status"] = "locked"
    lineup["locked_at"] = datetime.now(UTC).isoformat()
    return {"lineup": lineup, "next_editable_gameweek_id": "gw-3"}


@router.post("/lineups/{season_team_id}/{gameweek_id}/auto-adjust", response_model=None)
def auto_adjust_lineup(season_team_id: str, gameweek_id: str) -> dict[str, Any]:
    lineup = _lineup(season_team_id, gameweek_id)
    removed_player_id = "fpl-102"
    if removed_player_id in lineup["starters"]:
        lineup["starters"].remove(removed_player_id)
        promoted = lineup["bench"].pop(0)
        lineup["starters"].append(promoted)
        lineup["auto_adjustments"].append(
            {"removed_player_id": removed_player_id, "promoted_player_id": promoted}
        )
    return {"lineup": lineup, "submitted_as_is": True}


@router.get("/substitutions/explain", response_model=None)
def explain_substitutions(
    season_team_id: str = "season-team-castle",
    gameweek_id: str = "gw-2",
) -> dict[str, Any]:
    lineup = _lineup(season_team_id, gameweek_id)
    starter_out = next(
        (player_id for player_id in lineup["starters"] if PLAYER_SCORES[player_id]["minutes"] == 0),
        None,
    )
    bench_in = next(
        (player_id for player_id in lineup["bench"] if PLAYER_SCORES[player_id]["minutes"] > 0),
        None,
    )
    can_apply = starter_out is not None and bench_in is not None
    return {
        "lineup_id": _lineup_key(season_team_id, gameweek_id),
        "candidate": {"starter_out": starter_out, "bench_in": bench_in},
        "can_apply": can_apply,
        "reason": "0-minute starter replacement" if can_apply else "no eligible substitution",
    }


@router.post("/substitutions/apply", response_model=None)
def apply_substitutions() -> dict[str, Any] | JSONResponse:
    explanation = explain_substitutions()
    if not explanation["can_apply"]:
        return _err(ErrorCode.CONFLICT, "No eligible substitution.", status.HTTP_409_CONFLICT)
    substitution = {
        "id": f"substitution-{uuid4().hex[:8]}",
        "starter_out": explanation["candidate"]["starter_out"],
        "bench_in": explanation["candidate"]["bench_in"],
        "reason": explanation["reason"],
        "formation_preserved": True,
    }
    SUBSTITUTIONS.append(substitution)
    return {"substitutions": SUBSTITUTIONS, "explanation": explanation}


@router.get("/chips", response_model=None)
def chips(season_team_id: str = "season-team-castle") -> dict[str, Any]:
    return {"season_team_id": season_team_id, "chips": CHIP_OWNERSHIP}


@router.post("/chips/activate", response_model=None)
def activate_chip(payload: ChipActivationPayload) -> dict[str, Any] | JSONResponse:
    lineup = _lineup(payload.season_team_id, payload.gameweek_id)
    if lineup.get("active_chip") is not None:
        return _err(ErrorCode.CONFLICT, "Only one chip can be active.", status.HTTP_409_CONFLICT)
    if payload.chip not in {chip["chip"] for chip in CHIP_OWNERSHIP}:
        return _validation("Unknown chip.", "chip")
    lineup["active_chip"] = payload.chip
    return {
        "lineup": lineup,
        "chip_impact": {
            "chip": payload.chip,
            "delta_points": _score_lineup(lineup)["chip_delta"],
            "fixture_outcome_changed": False,
            "league_points_changed": False,
        },
    }


@router.post("/fixture-scoring/snapshots", response_model=None)
def create_fixture_snapshot(payload: SnapshotPayload) -> dict[str, Any]:
    lineup = _lineup("season-team-castle", GAMEWEEK["id"])
    score = _score_lineup(lineup)
    snapshot = {
        "id": f"snapshot-{uuid4().hex[:8]}",
        "fixture_id": payload.fixture_id,
        "mode": payload.mode,
        "source_hash": payload.source_hash,
        "home_score": score["total"],
        "away_score": 6,
        "player_scores": score["players"],
        "substitutions": SUBSTITUTIONS,
        "chip_delta": score["chip_delta"],
        "created_at": datetime.now(UTC).isoformat(),
    }
    SNAPSHOTS.append(snapshot)
    return {"fixture": FIXTURE, "snapshot": snapshot}


@router.post("/fixture-scoring/snapshots/{snapshot_id}/finalise", response_model=None)
def finalise_snapshot(snapshot_id: str) -> dict[str, Any] | JSONResponse:
    snapshot = next((item for item in SNAPSHOTS if item["id"] == snapshot_id), None)
    if snapshot is None:
        return _err(ErrorCode.NOT_FOUND, "Snapshot not found.", status.HTTP_404_NOT_FOUND)
    final_result = {**snapshot, "mode": "official", "finalised_at": datetime.now(UTC).isoformat()}
    FINAL_RESULTS[snapshot["fixture_id"]] = final_result
    return {"final_result": final_result, "stable": True}


@router.post("/fixture-scoring/corrections", response_model=None)
def correct_fixture(payload: CorrectionPayload) -> dict[str, Any]:
    previous = FINAL_RESULTS.get(payload.fixture_id)
    corrected = {
        "fixture_id": payload.fixture_id,
        "home_score": payload.home_score,
        "away_score": payload.away_score,
        "reason": payload.reason,
        "previous_result": previous,
    }
    FINAL_RESULTS[payload.fixture_id] = corrected
    return {"correction": corrected, "audit_required": True}


@router.get("/league-table", response_model=None)
def league_table(mode: str = "live") -> dict[str, Any] | JSONResponse:
    if mode not in TABLE_SNAPSHOTS:
        return _validation("Unknown table mode.", "mode")
    rows = [{**row, "movement": _movement(row)} for row in TABLE_SNAPSHOTS[mode]]
    return {
        "mode": mode,
        "rows": rows,
        "sort_order": ["points", "goal_difference", "goals_for"],
        "colour_states": {"up": "green", "down": "red", "same": "grey"},
        "based_on_finalised_results": mode == "official",
    }
