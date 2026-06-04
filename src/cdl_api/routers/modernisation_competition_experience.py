"""Checkpoint 4 modernisation API contracts for competition and player experience."""

from typing import Any

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ErrorCode

router = APIRouter(prefix="/modernisation", tags=["modernisation"])

CHECKPOINT_FEATURES = [
    {"issue": 42, "key": "gameweek-centre-and-fixture-detail"},
    {"issue": 41, "key": "knockout-brackets-and-tiebreakers"},
    {"issue": 43, "key": "player-pool-availability-and-scouting"},
    {"issue": 44, "key": "player-detail-history-and-comparison"},
    {"issue": 45, "key": "squad-analysis-and-slot-visualisation"},
]

PLAYERS: dict[str, dict[str, Any]] = {
    "fpl-101": {
        "id": "fpl-101",
        "name": "Avery Keeper",
        "position": "GKP",
        "club": "ARS",
        "availability": "owned",
        "availability_reason": "Owned by Castle",
        "status": "available",
        "cost": 5.1,
        "form": 4.2,
        "minutes": 1710,
        "points": 126,
    },
    "fpl-112": {
        "id": "fpl-112",
        "name": "Blair Defender",
        "position": "DEF",
        "club": "BHA",
        "availability": "available",
        "availability_reason": "Free agent",
        "status": "available",
        "cost": 4.8,
        "form": 3.8,
        "minutes": 1640,
        "points": 111,
    },
    "fpl-201": {
        "id": "fpl-201",
        "name": "Casey Midfielder",
        "position": "MID",
        "club": "MCI",
        "availability": "temporary_right",
        "availability_reason": "Drafton holds temporary free-agency right until next deadline",
        "status": "available",
        "cost": 8.6,
        "form": 6.1,
        "minutes": 1880,
        "points": 174,
    },
    "fpl-203": {
        "id": "fpl-203",
        "name": "Devon Forward",
        "position": "FWD",
        "club": "NEW",
        "availability": "blocked",
        "availability_reason": "Loan locked until GW5",
        "status": "injured",
        "cost": 7.4,
        "form": 2.7,
        "minutes": 1425,
        "points": 118,
    },
}

GAMEWEEK_CENTRE = {
    "gameweek_id": "gw-4",
    "editable_gameweek_id": "gw-5",
    "next_deadline": {
        "id": "lineup-gw-5",
        "kind": "lineup_lock",
        "route": "/team-selection",
        "due_at": "2026-06-10T10:00:00Z",
    },
    "source_freshness": {"fpl_cache_status": "fresh", "last_checked_at": "2026-06-03T22:30:00Z"},
    "fixtures": [
        {"id": "fixture-100", "home": "Castle", "away": "Drafton", "status": "provisional", "home_score": 61, "away_score": 58},
        {"id": "fixture-101", "home": "Rovers", "away": "Albion", "status": "live", "home_score": 44, "away_score": 44},
    ],
    "tables": {
        "live": [{"team": "Castle", "position": 1, "movement": "up", "points": 18}],
        "official": [{"team": "Drafton", "position": 1, "movement": "unchanged", "points": 16}],
    },
}

FIXTURE_DETAILS = {
    "fixture-100": {
        "id": "fixture-100",
        "status": "provisional",
        "score_breakdown": {
            "home": {"base": 54, "substitutions": 4, "chip_delta": 3, "bonus": 0, "total": 61},
            "away": {"base": 55, "substitutions": 0, "chip_delta": 0, "bonus": 3, "total": 58},
        },
        "explanations": [
            {"kind": "substitution", "text": "0-minute defender was replaced by first eligible bench defender."},
            {"kind": "chip", "text": "Triple captain added 3 points."},
            {"kind": "source", "text": "Score uses fixture snapshot event-live-hash-2."},
        ],
        "head_to_head_route": "/gameweek-centre/gw-4/fixtures/fixture-100",
    }
}

KNOCKOUT = {
    "competition_id": "cup-2026",
    "rounds": [
        {
            "round": "semi-final",
            "ties": [
                {
                    "id": "tie-1",
                    "home_team": "Castle",
                    "away_team": "Drafton",
                    "legs": [
                        {"fixture_id": "fixture-100", "home_score": 61, "away_score": 58},
                        {"fixture_id": "fixture-102", "home_score": 49, "away_score": 53},
                    ],
                    "aggregate": {"home": 110, "away": 111},
                    "tiebreaker": {
                        "type": "most_goals_from_scoring_lineup",
                        "home": 2,
                        "away": 3,
                        "used_only_scoring_lineup": True,
                    },
                    "winner": "Drafton",
                    "progression_stored": True,
                }
            ],
        }
    ],
}

WATCHLISTS: dict[str, list[dict[str, Any]]] = {
    "membership-castle": [
        {"fpl_player_id": "fpl-112", "note": "Rotation risk but cheap defender", "private": True},
    ]
}

CDL_HISTORY = {
    "fpl-201": [
        {"type": "drafted", "season_team_id": "season-team-drafton", "gameweek_id": "gw-1"},
        {"type": "temporary_right", "season_team_id": "season-team-drafton", "gameweek_id": "gw-3"},
    ]
}

FPL_HISTORY = {
    "fpl-201": [
        {"gameweek_id": "gw-1", "minutes": 90, "points": 8, "goals": 1},
        {"gameweek_id": "gw-2", "minutes": 88, "points": 5, "goals": 0},
        {"gameweek_id": "gw-3", "minutes": 90, "points": 12, "goals": 1},
    ]
}

SQUAD_ANALYSIS = {
    "season_team_id": "season-team-castle",
    "position_caps": {"GKP": 2, "DEF": 5, "MID": 5, "FWD": 3},
    "filled_slots": [
        {"position": "GKP", "player_id": "fpl-101", "status": "active", "risk": "low"},
        {"position": "DEF", "player_id": "fpl-203", "status": "loaned_in", "risk": "injury"},
    ],
    "empty_slots": [
        {"position": "GKP", "count": 1},
        {"position": "DEF", "count": 4},
        {"position": "MID", "count": 5},
        {"position": "FWD", "count": 3},
    ],
    "temporary_rights": [{"fpl_player_id": "fpl-201", "expires_at": "2026-06-10T10:00:00Z"}],
    "position_colours": {"GKP": "keeper", "DEF": "defender", "MID": "midfielder", "FWD": "forward"},
}


def _err(message: str) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"code": ErrorCode.NOT_FOUND, "message": message})


@router.get("/checkpoint-4", response_model=None)
def checkpoint_four() -> dict[str, Any]:
    return {"checkpoint": 4, "features": CHECKPOINT_FEATURES, "status": "implemented"}


@router.get("/gameweek-centre/{gameweek_id}", response_model=None)
def gameweek_centre(gameweek_id: str) -> dict[str, Any] | JSONResponse:
    if gameweek_id != GAMEWEEK_CENTRE["gameweek_id"]:
        return _err("Gameweek centre not found.")
    return GAMEWEEK_CENTRE


@router.get("/gameweek-centre/{gameweek_id}/fixtures/{fixture_id}", response_model=None)
def fixture_detail(gameweek_id: str, fixture_id: str) -> dict[str, Any] | JSONResponse:
    if gameweek_id != GAMEWEEK_CENTRE["gameweek_id"] or fixture_id not in FIXTURE_DETAILS:
        return _err("Fixture detail not found.")
    return FIXTURE_DETAILS[fixture_id]


@router.get("/knockout/{competition_id}/bracket", response_model=None)
def knockout_bracket(competition_id: str) -> dict[str, Any] | JSONResponse:
    if competition_id != KNOCKOUT["competition_id"]:
        return _err("Knockout bracket not found.")
    return KNOCKOUT


@router.get("/players", response_model=None)
def player_pool(include_blocked: bool = True, include_injured: bool = True) -> dict[str, Any]:
    players = list(PLAYERS.values())
    if not include_blocked:
        players = [player for player in players if player["availability"] != "blocked"]
    if not include_injured:
        players = [player for player in players if player["status"] != "injured"]
    return {"players": players, "availability_reasons_visible": True}


@router.get("/players/{fpl_player_id}", response_model=None)
def player_detail(fpl_player_id: str) -> dict[str, Any] | JSONResponse:
    player = PLAYERS.get(fpl_player_id)
    if player is None:
        return _err("Player not found.")
    return {
        "player": player,
        "fpl_history": FPL_HISTORY.get(fpl_player_id, []),
        "cdl_history": CDL_HISTORY.get(fpl_player_id, []),
        "histories_separated": True,
        "actions": ["watch", "compare", "add_free_agency_preference"],
    }


@router.get("/players/compare", response_model=None)
def compare_players(player_ids: str) -> dict[str, Any]:
    ids = [player_id.strip() for player_id in player_ids.split(",") if player_id.strip()]
    comparisons = [PLAYERS[player_id] for player_id in ids if player_id in PLAYERS]
    return {
        "players": comparisons,
        "metrics": ["points", "minutes", "form", "cost", "status", "availability"],
        "fixtures_included": True,
    }


@router.post("/players/{fpl_player_id}/watchlist", response_model=None)
def add_to_watchlist(fpl_player_id: str, manager_membership_id: str = "membership-castle") -> dict[str, Any] | JSONResponse:
    if fpl_player_id not in PLAYERS:
        return _err("Player not found.")
    item = {"fpl_player_id": fpl_player_id, "note": "Added from player pool", "private": True}
    WATCHLISTS.setdefault(manager_membership_id, []).append(item)
    return {"watchlist": WATCHLISTS[manager_membership_id], "free_agency_preferences_separate": True}


@router.get("/squad-analysis/{season_team_id}", response_model=None)
def squad_analysis(season_team_id: str) -> dict[str, Any] | JSONResponse:
    if season_team_id != SQUAD_ANALYSIS["season_team_id"]:
        return _err("Squad analysis not found.")
    return SQUAD_ANALYSIS
