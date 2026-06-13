"""Squad management API routes."""

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ErrorCode, ValidationErrorResponse
from cdl_api.contracts.squad import (
    InterestCreateRequest,
    InterestDeleteResponse,
    InterestResponse,
    PlayerMetric,
    PlayerPosition,
    ScoutingFilters,
    ScoutingPlayersResponse,
    SquadSummaryResponse,
    TradeCreateRequest,
    TradeProposal,
    TradesResponse,
    TradeUpdateRequest,
)
from cdl_api.repositories.factory import build_repositories
from cdl_api.services.squad import SquadManagementService, SquadValidationError
from cdl_api.settings import Settings, get_settings

router = APIRouter(tags=["squad-management"])


def get_squad_service(settings: Settings = Depends(get_settings)) -> SquadManagementService:
    repositories = build_repositories(settings)
    return SquadManagementService(repositories.squad)


def validation_error_response(exc: SquadValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ValidationErrorResponse(
            code=ErrorCode.VALIDATION_ERROR,
            message=str(exc),
            issues=exc.issues,
        ).model_dump(mode="json"),
    )


@router.get("/squad/summary", response_model=SquadSummaryResponse)
def squad_summary(
    service: SquadManagementService = Depends(get_squad_service),
) -> SquadSummaryResponse:
    return service.get_summary()


@router.get("/scouting/players", response_model=ScoutingPlayersResponse)
def scouting_players(
    position: PlayerPosition | None = None,
    draft_team_id: str | None = None,
    epl_team_id: str | None = None,
    query: str | None = Query(default=None, alias="q"),
    metric: PlayerMetric = PlayerMetric.TOTAL_POINTS,
    service: SquadManagementService = Depends(get_squad_service),
) -> ScoutingPlayersResponse:
    return service.scout_players(
        ScoutingFilters(
            position=position,
            draft_team_id=draft_team_id,
            epl_team_id=epl_team_id,
            query=query,
            metric=metric,
        )
    )


@router.post("/interests", response_model=InterestResponse)
def create_interest(
    payload: InterestCreateRequest,
    service: SquadManagementService = Depends(get_squad_service),
) -> InterestResponse | JSONResponse:
    try:
        return service.create_interest(payload)
    except SquadValidationError as exc:
        return validation_error_response(exc)


@router.delete("/interests/{interest_id}", response_model=InterestDeleteResponse)
def delete_interest(
    interest_id: str,
    service: SquadManagementService = Depends(get_squad_service),
) -> InterestDeleteResponse:
    service.delete_interest(interest_id)
    return InterestDeleteResponse(deleted_interest_id=interest_id)


@router.get("/trades", response_model=TradesResponse)
def list_trades(
    service: SquadManagementService = Depends(get_squad_service),
) -> TradesResponse:
    return TradesResponse(trades=service.list_trades())


@router.post("/trades", response_model=TradeProposal)
def create_trade(
    payload: TradeCreateRequest,
    service: SquadManagementService = Depends(get_squad_service),
) -> TradeProposal | JSONResponse:
    try:
        return service.create_trade(payload)
    except SquadValidationError as exc:
        return validation_error_response(exc)


@router.put("/trades/{trade_id}", response_model=TradeProposal)
def update_trade(
    trade_id: str,
    payload: TradeUpdateRequest,
    service: SquadManagementService = Depends(get_squad_service),
) -> TradeProposal | JSONResponse:
    trade = service.update_trade(trade_id, payload.status)
    if trade is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "code": "not_found",
                "message": "Trade not found.",
                "details": {"trade_id": trade_id},
            },
        )
    return trade
