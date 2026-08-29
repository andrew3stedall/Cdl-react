"""Authenticated routes for official FPL cache refresh, status, and player history."""

from fastapi import APIRouter, Depends, HTTPException, status

from cdl_api.contracts.fpl_data import (
    FplCacheStatusResponse,
    FplPlayerHistoryResponse,
    FplRefreshRequest,
    FplRefreshResponse,
)
from cdl_api.contracts.session import SessionUser
from cdl_api.database import build_session_factory
from cdl_api.fpl_client import FplApiClient, FplApiError
from cdl_api.repositories.postgres_fpl_data import (
    InvalidFplPayloadError,
    PostgreSQLFplDataRepository,
)
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.services.fpl_data_service import FplDataService
from cdl_api.services.fpl_settlement import FplSettlementService
from cdl_api.settings import Settings, get_settings

router = APIRouter(prefix="/fpl", tags=["fpl"])


def get_fpl_service(settings: Settings = Depends(get_settings)) -> FplDataService:
    if settings.repository_mode != "postgres":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Official FPL ingestion requires PostgreSQL repository mode.",
        )
    session_factory = build_session_factory(settings)
    repository = PostgreSQLFplDataRepository(session_factory)
    client = FplApiClient(
        base_url=settings.fpl_api_base_url,
        timeout_seconds=settings.fpl_api_timeout_seconds,
    )
    return FplDataService(
        client,
        repository,
        settlement=FplSettlementService(session_factory).settle,
    )


def require_fpl_manager(
    user: SessionUser = Depends(require_authenticated_session),
) -> SessionUser:
    if not {"manager", "commissioner", "admin"}.intersection(user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access is required to refresh FPL data.",
        )
    return user


@router.get("/status", response_model=FplCacheStatusResponse)
def fpl_status(
    _: SessionUser = Depends(require_authenticated_session),
    service: FplDataService = Depends(get_fpl_service),
) -> FplCacheStatusResponse:
    return service.status()


@router.get("/players/{player_id}/history", response_model=FplPlayerHistoryResponse)
def fpl_player_history(
    player_id: str,
    _: SessionUser = Depends(require_authenticated_session),
    service: FplDataService = Depends(get_fpl_service),
) -> FplPlayerHistoryResponse:
    try:
        return service.player_history(player_id)
    except (FplApiError, InvalidFplPayloadError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.post("/refresh", response_model=FplRefreshResponse)
def refresh_fpl_data(
    payload: FplRefreshRequest,
    _: SessionUser = Depends(require_fpl_manager),
    service: FplDataService = Depends(get_fpl_service),
) -> FplRefreshResponse:
    try:
        return service.refresh(payload.resources)
    except (FplApiError, InvalidFplPayloadError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
