"""Fixture difficulty ratings API routes."""

from fastapi import APIRouter, Depends, Query

from cdl_api.contracts.fdr import (
    FixtureDifficultyCalculationInputAudit,
    FixtureDifficultyCombinedResponse,
    FixtureDifficultyFilters,
    FixtureDifficultyResponse,
    FixtureDifficultyScaleStep,
    FixtureDifficultyView,
)
from cdl_api.database import build_session_factory
from cdl_api.repositories.fdr_repository import FixtureDifficultyRepository
from cdl_api.repositories.postgres_fdr import PostgreSQLFixtureDifficultyRepository
from cdl_api.services.fdr_service import FixtureDifficultyDataRepository, FixtureDifficultyService
from cdl_api.settings import Settings, get_settings

router = APIRouter(prefix="/fdr", tags=["fdr"])


def get_fdr_repository(
    settings: Settings = Depends(get_settings),
) -> FixtureDifficultyDataRepository:
    if settings.repository_mode == "postgres":
        return PostgreSQLFixtureDifficultyRepository(build_session_factory(settings))
    return FixtureDifficultyRepository()


@router.get("", response_model=FixtureDifficultyCombinedResponse)
def combined_fdr(
    season: str = "2025/26",
    team_id: str | None = None,
    gameweek_start: int = Query(default=12, ge=1, le=38),
    gameweek_end: int = Query(default=16, ge=1, le=38),
    repository: FixtureDifficultyDataRepository = Depends(get_fdr_repository),
) -> FixtureDifficultyCombinedResponse:
    return FixtureDifficultyService(repository).get_combined(
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
    repository: FixtureDifficultyDataRepository = Depends(get_fdr_repository),
) -> FixtureDifficultyResponse:
    return FixtureDifficultyService(repository).get_view(
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
    repository: FixtureDifficultyDataRepository = Depends(get_fdr_repository),
) -> FixtureDifficultyResponse:
    return FixtureDifficultyService(repository).get_view(
        FixtureDifficultyView.DEFENCE,
        FixtureDifficultyFilters(
            season=season,
            team_id=team_id,
            gameweek_start=gameweek_start,
            gameweek_end=gameweek_end,
        ),
    )


@router.get("/scales", response_model=list[FixtureDifficultyScaleStep])
def fdr_scales(
    repository: FixtureDifficultyDataRepository = Depends(get_fdr_repository),
) -> list[FixtureDifficultyScaleStep]:
    return FixtureDifficultyService(repository).get_scales()


@router.get(
    "/calculation-inputs",
    response_model=list[FixtureDifficultyCalculationInputAudit],
)
def fdr_calculation_inputs(
    season: str = "2025/26",
    repository: FixtureDifficultyDataRepository = Depends(get_fdr_repository),
) -> list[FixtureDifficultyCalculationInputAudit]:
    return FixtureDifficultyService(repository).get_calculation_inputs(season)
