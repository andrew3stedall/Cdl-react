"""Ranked free-agency draw API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ErrorCode, ValidationErrorResponse
from cdl_api.contracts.free_agency import (
    FreeAgencyDrawCreateRequest,
    FreeAgencyDrawResponse,
    FreeAgencyPreference,
    FreeAgencyPreferencesRequest,
    FreeAgencyResultsResponse,
)
from cdl_api.contracts.session import SessionUser
from cdl_api.database import build_session_factory
from cdl_api.repositories.free_agency_draws import PostgreSQLFreeAgencyDrawRepository
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.routers.squad import require_manager_session, require_trade_approval_session
from cdl_api.services.free_agency_draws import FreeAgencyDrawError, FreeAgencyDrawService
from cdl_api.services.live_draft import LiveDraftError
from cdl_api.settings import Settings, get_settings
from cdl_api.staging_draft_seed import UnassignedManagerContextError

router = APIRouter(tags=["free-agency-draws"])


def get_free_agency_draw_service(
    user: SessionUser = Depends(require_trade_approval_session),
    settings: Settings = Depends(get_settings),
) -> FreeAgencyDrawService:
    if settings.repository_mode != "postgres":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ranked free-agency draws require PostgreSQL persistence.",
        )
    session_factory = build_session_factory(settings)
    try:
        squad = PostgreSQLSquadRepository(session_factory, user_id=user.id)
    except UnassignedManagerContextError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated manager does not have an assigned team in this league.",
        ) from exc
    repository = PostgreSQLFreeAgencyDrawRepository(
        session_factory,
        user_id=user.id,
        manager_id=squad._manager_id,
        team_id=squad.manager_team.id,
    )
    return FreeAgencyDrawService(repository)


def validation_error(exc: FreeAgencyDrawError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ValidationErrorResponse(
            code=ErrorCode.VALIDATION_ERROR,
            message=str(exc),
            issues=[],
        ).model_dump(mode="json"),
    )


def _not_found(draw_id: str) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "code": ErrorCode.NOT_FOUND.value,
            "message": "Free-agency draw not found.",
            "details": {"draw_id": draw_id},
        },
    )


@router.get("/free-agency/draws", response_model=list[FreeAgencyDrawResponse])
def list_draws(
    _: SessionUser = Depends(require_manager_session),
    service: FreeAgencyDrawService = Depends(get_free_agency_draw_service),
) -> list[FreeAgencyDrawResponse]:
    return service.list_draws()


@router.post("/free-agency/draws", response_model=FreeAgencyDrawResponse)
def create_draw(
    payload: FreeAgencyDrawCreateRequest,
    _: SessionUser = Depends(require_trade_approval_session),
    service: FreeAgencyDrawService = Depends(get_free_agency_draw_service),
) -> FreeAgencyDrawResponse | JSONResponse:
    try:
        return service.create_draw(payload)
    except FreeAgencyDrawError as exc:
        return validation_error(exc)


@router.post("/free-agency/draws/{draw_id}/open", response_model=FreeAgencyDrawResponse)
def open_draw(
    draw_id: str,
    _: SessionUser = Depends(require_trade_approval_session),
    service: FreeAgencyDrawService = Depends(get_free_agency_draw_service),
) -> FreeAgencyDrawResponse | JSONResponse:
    try:
        draw = service.open_draw(draw_id)
    except FreeAgencyDrawError as exc:
        return validation_error(exc)
    return _not_found(draw_id) if draw is None else draw


@router.post("/free-agency/draws/{draw_id}/lock", response_model=FreeAgencyDrawResponse)
def lock_draw(
    draw_id: str,
    _: SessionUser = Depends(require_trade_approval_session),
    service: FreeAgencyDrawService = Depends(get_free_agency_draw_service),
) -> FreeAgencyDrawResponse | JSONResponse:
    try:
        draw = service.lock_draw(draw_id)
    except FreeAgencyDrawError as exc:
        return validation_error(exc)
    return _not_found(draw_id) if draw is None else draw


@router.put(
    "/free-agency/draws/{draw_id}/preferences",
    response_model=list[FreeAgencyPreference],
)
def submit_preferences(
    draw_id: str,
    payload: FreeAgencyPreferencesRequest,
    _: SessionUser = Depends(require_manager_session),
    service: FreeAgencyDrawService = Depends(get_free_agency_draw_service),
) -> list[FreeAgencyPreference] | JSONResponse:
    try:
        return service.submit_preferences(draw_id, payload)
    except LookupError:
        return _not_found(draw_id)
    except FreeAgencyDrawError as exc:
        return validation_error(exc)


@router.get(
    "/free-agency/draws/{draw_id}/preferences",
    response_model=list[FreeAgencyPreference],
)
def get_preferences(
    draw_id: str,
    _: SessionUser = Depends(require_manager_session),
    service: FreeAgencyDrawService = Depends(get_free_agency_draw_service),
) -> list[FreeAgencyPreference]:
    return service.preferences(draw_id)


@router.post("/free-agency/draws/{draw_id}/process", response_model=FreeAgencyDrawResponse)
def process_draw(
    draw_id: str,
    _: SessionUser = Depends(require_trade_approval_session),
    service: FreeAgencyDrawService = Depends(get_free_agency_draw_service),
) -> FreeAgencyDrawResponse | JSONResponse:
    try:
        draw = service.process_draw(draw_id)
    except LiveDraftError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except FreeAgencyDrawError as exc:
        return validation_error(exc)
    return _not_found(draw_id) if draw is None else draw


@router.get("/free-agency/draws/{draw_id}/results", response_model=FreeAgencyResultsResponse)
def get_results(
    draw_id: str,
    _: SessionUser = Depends(require_manager_session),
    service: FreeAgencyDrawService = Depends(get_free_agency_draw_service),
) -> FreeAgencyResultsResponse | JSONResponse:
    result = service.results(draw_id)
    return _not_found(draw_id) if result is None else result
