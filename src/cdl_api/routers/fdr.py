"""Fixture difficulty ratings API routes."""

from fastapi import APIRouter, Query

from cdl_api.contracts.fdr import (
    FixtureDifficultyCombinedResponse,
    FixtureDifficultyFilters,
    FixtureDifficultyResponse,
    FixtureDifficultyScaleStep,
    FixtureDifficultyView,
)
from cdl_api.services.fdr_service import FixtureDifficultyService

router = APIRouter(prefix="/fdr", tags=["fdr"])

_fdr_service = FixtureDifficultyService()


@router.get("", response_model=FixtureDifficultyCombinedResponse)
def combined_fdr(
    season: str = "2025/26",
    team_id: str | None = None,
    gameweek_start: int = Query(default=12, ge=1, le=38),
    gameweek_end: int = Query(default=16, ge=1, le=38),
) -> FixtureDifficultyCombinedResponse:
    return _fdr_service.get_combined(
        FixtureDifficultyFilters(
            season=season,
            team_id=team_id,
            gameweek_start=gameweek_start,
            gameweek_end=gameweek_end,
        )
    )


@router.get("/attack", response_model=FixtureDifficultyResponse)
def attack_fdr(
    season: str = "2025/26",
    team_id: str | None = None,
    gameweek_start: int = Query(default=12, ge=1, le=38),
    gameweek_end: int = Query(default=16, ge=1, le=38),
) -> FixtureDifficultyResponse:
    return _fdr_service.get_view(
        FixtureDifficultyView.ATTACK,
        FixtureDifficultyFilters(
            season=season,
            team_id=team_id,
            gameweek_start=gameweek_start,
            gameweek_end=gameweek_end,
        ),
    )


@router.get("/defence", response_model=FixtureDifficultyResponse)
def defence_fdr(
    season: str = "2025/26",
    team_id: str | None = None,
    gameweek_start: int = Query(default=12, ge=1, le=38),
    gameweek_end: int = Query(default=16, ge=1, le=38),
) -> FixtureDifficultyResponse:
    return _fdr_service.get_view(
        FixtureDifficultyView.DEFENCE,
        FixtureDifficultyFilters(
            season=season,
            team_id=team_id,
            gameweek_start=gameweek_start,
            gameweek_end=gameweek_end,
        ),
    )


@router.get("/scales", response_model=list[FixtureDifficultyScaleStep])
def fdr_scales() -> list[FixtureDifficultyScaleStep]:
    return _fdr_service.get_scales()
