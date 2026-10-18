"""Read-only endpoints for external companion applications."""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from cdl_api.contracts.companion import (
    CompanionDraftPicksResponse,
    CompanionDrawResultsResponse,
    CompanionSquadMovementsResponse,
    CompanionTeamSelectionsResponse,
    CompanionTeamsResponse,
    CompanionTradesResponse,
)
from cdl_api.database import build_session_factory
from cdl_api.repositories.companion import CompanionDataRepository
from cdl_api.settings import Settings, get_settings

router = APIRouter(prefix="/companion", tags=["companion-api"])


def get_companion_repository(
    settings: Settings = Depends(get_settings),
) -> CompanionDataRepository:
    if settings.repository_mode != "postgres":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Companion data requires PostgreSQL persistence.",
        )
    return CompanionDataRepository(build_session_factory(settings))


@router.get("/teams", response_model=CompanionTeamsResponse)
def get_teams(
    repository: CompanionDataRepository = Depends(get_companion_repository),
) -> CompanionTeamsResponse:
    return CompanionTeamsResponse(teams=repository.teams())


@router.get("/draft-picks", response_model=CompanionDraftPicksResponse)
def get_draft_picks(
    repository: CompanionDataRepository = Depends(get_companion_repository),
) -> CompanionDraftPicksResponse:
    return CompanionDraftPicksResponse.model_validate(repository.draft_picks())


@router.get("/draw-results", response_model=CompanionDrawResultsResponse)
def get_draw_results(
    repository: CompanionDataRepository = Depends(get_companion_repository),
) -> CompanionDrawResultsResponse:
    return CompanionDrawResultsResponse(draws=repository.draw_results())


@router.get("/squad-movements", response_model=CompanionSquadMovementsResponse)
def get_squad_movements(
    repository: CompanionDataRepository = Depends(get_companion_repository),
) -> CompanionSquadMovementsResponse:
    return CompanionSquadMovementsResponse(movements=repository.squad_movements())


@router.get("/trades", response_model=CompanionTradesResponse)
def get_trades(
    repository: CompanionDataRepository = Depends(get_companion_repository),
) -> CompanionTradesResponse:
    return CompanionTradesResponse(trades=repository.trades())


@router.get("/team-selections", response_model=CompanionTeamSelectionsResponse)
def get_team_selections(
    gameweek: int | None = Query(default=None, ge=1),
    repository: CompanionDataRepository = Depends(get_companion_repository),
) -> CompanionTeamSelectionsResponse:
    return CompanionTeamSelectionsResponse.model_validate(repository.team_selections(gameweek))
