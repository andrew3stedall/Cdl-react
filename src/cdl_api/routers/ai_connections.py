"""Owner-facing AI connection verification state, manual checks and diagnostics."""

from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, Response

from cdl_api.contracts.ai_connections import (
    AIConnectionDiagnosticsResponse,
    AIConnectionStatusResponse,
    AIMCPEndpointStatus,
)
from cdl_api.contracts.session import SessionUser
from cdl_api.database import build_session_factory
from cdl_api.repositories.ai_execution import build_ai_execution_repository
from cdl_api.repositories.factory import build_repositories
from cdl_api.repositories.oauth import build_oauth_repository
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.services.ai_connection_diagnostics import (
    AIConnectionDiagnosticsService,
    AIConnectionNotFoundError,
)
from cdl_api.services.ai_execution import AIExecutionPolicy
from cdl_api.settings import Settings, get_settings

router = APIRouter(tags=["ai-connections"])
_NO_STORE = {"Cache-Control": "no-store"}


def _team_lookup(settings: Settings) -> Callable[[str], bool | None]:
    def lookup(user_id: str) -> bool | None:
        access = build_repositories(settings).league_memberships.access_for_user(user_id)
        return bool(access and access.team_id)

    return lookup


def get_ai_connection_diagnostics(
    settings: Settings = Depends(get_settings),
) -> AIConnectionDiagnosticsService:
    if not settings.mcp_oauth_enabled:
        raise HTTPException(status_code=404, detail="AI connections are disabled.")
    if not settings.oauth_signing_secret:
        raise HTTPException(status_code=503, detail="OAuth is not configured.")
    factory = build_session_factory(settings) if settings.repository_mode == "postgres" else None
    execution = build_ai_execution_repository(settings.repository_mode, factory)
    return AIConnectionDiagnosticsService(
        connections=build_oauth_repository(settings.repository_mode, factory),
        evidence=execution,
        policy=AIExecutionPolicy(execution),
        endpoint=AIMCPEndpointStatus(
            url=f"{settings.oauth_issuer_url.rstrip('/')}/mcp",
            oauth_enabled=settings.mcp_oauth_enabled,
            remote_enabled=settings.mcp_remote_enabled,
            browser_enabled=settings.mcp_browser_enabled,
            execution_enabled=settings.mcp_execution_enabled,
        ),
        team_lookup=_team_lookup(settings),
    )


@router.get("/ai/connections", response_model=AIConnectionDiagnosticsResponse)
def connection_diagnostics(
    response: Response,
    user: SessionUser = Depends(require_authenticated_session),
    service: AIConnectionDiagnosticsService = Depends(get_ai_connection_diagnostics),
) -> AIConnectionDiagnosticsResponse:
    response.headers.update(_NO_STORE)
    return service.diagnostics(user.id)


@router.post("/ai/connections/{connection_id}/check", response_model=AIConnectionStatusResponse)
def check_connection(
    connection_id: str,
    response: Response,
    user: SessionUser = Depends(require_authenticated_session),
    service: AIConnectionDiagnosticsService = Depends(get_ai_connection_diagnostics),
) -> AIConnectionStatusResponse:
    response.headers.update(_NO_STORE)
    try:
        return service.check(user.id, connection_id)
    except AIConnectionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="AI connection not found.") from exc
