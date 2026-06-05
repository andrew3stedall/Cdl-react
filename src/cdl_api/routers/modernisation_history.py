"""Checkpoint 5 modernisation API contracts for migration, parity, and roadmap work."""

from typing import Any

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ErrorCode

router = APIRouter(prefix="/modernisation", tags=["modernisation"])

CHECKPOINT_FEATURES = [
    {"issue": 47, "key": "legacy-data-migration-and-backfill"},
    {"issue": 48, "key": "domain-test-strategy-and-parity-tests"},
    {"issue": 49, "key": "implementation-sequencing-roadmap"},
]

MIGRATION_DRY_RUN = {
    "run_id": "dry-run-legacy-2026-06-05",
    "mode": "strict",
    "source": "legacy_php_archive",
    "status": "review_required",
    "counts": {
        "legacy_managers": 8,
        "legacy_teams": 8,
        "legacy_players": 612,
        "legacy_fixtures": 342,
        "importable_records": 957,
        "archived_reference_records": 34,
    },
    "review_items": [
        {
            "id": "review-001",
            "severity": "warning",
            "legacy_table": "draft_player_history",
            "legacy_id": "draft-row-88",
            "reason": "Missing manager mapping; strict mode requires manual review.",
            "action": "map_manager_or_archive_reference",
        },
        {
            "id": "review-002",
            "severity": "info",
            "legacy_table": "cup_ties",
            "legacy_id": "cup-2017-final",
            "reason": "Legacy tiebreaker label is ambiguous; archived for reference instead of guessed.",
            "action": "archive_reference_only",
        },
    ],
    "unguessed_historical_data": True,
}

ARCHIVE_REFERENCE = {
    "archive_id": "legacy-archive-2026",
    "mode": "archive_reference",
    "records_viewable": True,
    "tables": [
        {"name": "legacy_fixture_results", "records": 342},
        {"name": "legacy_draft_events", "records": 219},
        {"name": "legacy_cup_ties", "records": 48},
    ],
    "limitations": [
        "Ambiguous legacy tiebreaker labels are shown as reference data only.",
        "Rows without manager identity mappings are not imported into active domain tables.",
    ],
}

TEST_STRATEGY = {
    "strategy_id": "domain-parity-2026",
    "test_layers": [
        "unit",
        "service",
        "scenario",
        "permission",
        "time_based",
        "migration",
        "legacy_parity",
    ],
    "fixed_clock_supported": True,
    "critical_scenarios": [
        "league_setup_to_draft_assignment",
        "free_agency_draw_to_temporary_right_expiry",
        "transfer_approval_to_squad_update",
        "lineup_lock_to_fixture_scoring_snapshot",
        "knockout_qualification_to_tiebreaker_progression",
    ],
    "legacy_gaps_explicit": True,
}

PARITY_MATRIX = {
    "matrix_id": "checkpoint-5-parity-matrix",
    "coverage": [
        {"domain": "draft", "scenario_tests": True, "legacy_parity": "characterised"},
        {"domain": "free_agency", "scenario_tests": True, "legacy_parity": "characterised"},
        {"domain": "transfers", "scenario_tests": True, "legacy_parity": "documented_difference"},
        {"domain": "loans", "scenario_tests": True, "legacy_parity": "characterised"},
        {"domain": "lineups", "scenario_tests": True, "legacy_parity": "characterised"},
        {"domain": "chips", "scenario_tests": True, "legacy_parity": "documented_difference"},
        {"domain": "scoring", "scenario_tests": True, "legacy_parity": "characterised"},
        {"domain": "tables", "scenario_tests": True, "legacy_parity": "characterised"},
        {"domain": "knockouts", "scenario_tests": True, "legacy_parity": "characterised"},
    ],
    "minimum_gate": "scenario_and_gap_documentation",
}

ROADMAP = {
    "roadmap_id": "modernisation-checkpoint-roadmap",
    "guard_incomplete_states": True,
    "order_basis": "domain_dependency_order",
    "checkpoints": [
        {"checkpoint": 1, "title": "Foundation and Draft", "status": "complete", "pr": 50},
        {"checkpoint": 2, "title": "Weekly Gameplay", "status": "complete", "pr": 51},
        {"checkpoint": 3, "title": "Squad Movement", "status": "complete", "pr": 52},
        {"checkpoint": 4, "title": "Competition Experience", "status": "complete", "pr": 53},
        {"checkpoint": 5, "title": "History and Documentation", "status": "implemented", "issues": [47, 48, 49]},
    ],
    "sequencing_risks": [
        {"risk": "legacy_identity_mapping", "mitigation": "strict dry-run review items before import"},
        {"risk": "parity_drift", "mitigation": "characterisation tests and documented differences"},
        {"risk": "partial_feature_exposure", "mitigation": "roadmap guards and explicit status contracts"},
    ],
}


def _err(message: str) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"code": ErrorCode.NOT_FOUND, "message": message})


@router.get("/checkpoint-5", response_model=None)
def checkpoint_five() -> dict[str, Any]:
    return {"checkpoint": 5, "features": CHECKPOINT_FEATURES, "status": "implemented"}


@router.get("/migration/dry-run", response_model=None)
def migration_dry_run(mode: str = "strict") -> dict[str, Any] | JSONResponse:
    if mode not in {"strict", "archive_reference"}:
        return _err("Migration mode not found.")
    payload = dict(MIGRATION_DRY_RUN)
    payload["mode"] = mode
    return payload


@router.get("/migration/review-items", response_model=None)
def migration_review_items() -> dict[str, Any]:
    return {"review_items": MIGRATION_DRY_RUN["review_items"], "unguessed_historical_data": True}


@router.get("/migration/archive", response_model=None)
def migration_archive() -> dict[str, Any]:
    return ARCHIVE_REFERENCE


@router.get("/test-strategy", response_model=None)
def test_strategy() -> dict[str, Any]:
    return TEST_STRATEGY


@router.get("/parity-matrix", response_model=None)
def parity_matrix() -> dict[str, Any]:
    return PARITY_MATRIX


@router.get("/roadmap", response_model=None)
def roadmap() -> dict[str, Any]:
    return ROADMAP
