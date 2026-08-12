"""Squad management API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ErrorCode, ValidationErrorResponse
from cdl_api.contracts.session import SessionUser
from cdl_api.contracts.squad import (
    InterestCreateRequest,
    InterestDeleteResponse,
    InterestResponse,
    PlayerMetric,
    PlayerPosition,
    ScoutingFilters,
    ScoutingPlayersResponse,
    SquadChangesRequest,
    SquadChangesResponse,
    SquadNotificationsResponse,
    SquadSummaryResponse,
    TradeCreateRequest,
    TradeProposal,
    TradesResponse,
    TradeUpdateRequest,
)
from cdl_api.database import build_session_factory
from cdl_api.repositories.factory import build_repositories
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.routers.auth import get_auth_service, get_optional_authenticated_session
from cdl_api.services.auth import AuthenticationService
from cdl_api.services.squad import SquadManagementService, SquadValidationError
from cdl_api.settings import Settings, get_settings

router = APIRouter(tags=["squad-management"])


def get_squad_service(
    settings: Settings = Depends(get_settings),
    user: SessionUser | None = Depends(get_optional_authenticated_session),
) -> SquadManagementService:
    if settings.repository_mode == "postgres":
        return SquadManagementService(
            PostgreSQLSquadRepository(
                build_session_factory(settings),
                user_id=user.id if user is not None else None,
            )
        )
    repositories = build_repositories(settings)
    return SquadManagementService(repositories.squad)


def require_manager_session(
    request: Request,
    settings: Settings = Depends(get_settings),
    auth_service: AuthenticationService = Depends(get_auth_service),
) -> SessionUser:
    session = auth_service.get_session(request.cookies.get(settings.session_cookie_name))
    if not session.is_authenticated or session.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    if "manager" not in session.user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager role required.",
        )
    return session.user


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


@router.get("/squad/changes", response_model=SquadChangesResponse)
def squad_changes(
    _: SessionUser = Depends(require_manager_session),
    service: SquadManagementService = Depends(get_squad_service),
) -> SquadChangesResponse:
    return service.get_changes()


@router.post("/squad/changes", response_model=SquadSummaryResponse)
def apply_squad_changes(
    payload: SquadChangesRequest,
    _: SessionUser = Depends(require_manager_session),
    service: SquadManagementService = Depends(get_squad_service),
) -> SquadSummaryResponse | JSONResponse:
    try:
        return service.apply_changes(payload)
    except SquadValidationError as exc:
        return validation_error_response(exc)


@router.get("/squad/notifications", response_model=SquadNotificationsResponse)
def squad_notifications(
    _: SessionUser = Depends(require_manager_session),
    service: SquadManagementService = Depends(get_squad_service),
) -> SquadNotificationsResponse:
    return service.notifications()


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


@router.get("/interests", response_model=list[InterestResponse])
def list_interests(
    _: SessionUser = Depends(require_manager_session),
    service: SquadManagementService = Depends(get_squad_service),
) -> list[InterestResponse]:
    return service.list_interests()


@router.post("/interests", response_model=InterestResponse)
def create_interest(
    payload: InterestCreateRequest,
    _: SessionUser = Depends(require_manager_session),
    service: SquadManagementService = Depends(get_squad_service),
) -> InterestResponse | JSONResponse:
    try:
        return service.create_interest(payload)
    except SquadValidationError as exc:
        return validation_error_response(exc)


@router.delete("/interests/{interest_id}", response_model=InterestDeleteResponse)
def delete_interest(
    interest_id: str,
    _: SessionUser = Depends(require_manager_session),
    service: SquadManagementService = Depends(get_squad_service),
) -> InterestDeleteResponse:
    service.delete_interest(interest_id)
    return InterestDeleteResponse(deleted_interest_id=interest_id)


@router.get("/trades", response_model=TradesResponse)
def list_trades(
    _: SessionUser = Depends(require_manager_session),
    service: SquadManagementService = Depends(get_squad_service),
) -> TradesResponse:
    return TradesResponse(trades=service.list_trades())


@router.post("/trades", response_model=TradeProposal)
def create_trade(
    payload: TradeCreateRequest,
    _: SessionUser = Depends(require_manager_session),
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
    user: SessionUser = Depends(require_manager_session),
    service: SquadManagementService = Depends(get_squad_service),
) -> TradeProposal | JSONResponse:
    try:
        trade = service.update_trade(trade_id, payload.status, user.id)
    except SquadValidationError as exc:
        return validation_error_response(exc)
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
