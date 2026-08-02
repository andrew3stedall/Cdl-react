"""Staging-only application login boundary for public Cloud Run invocation."""

from collections.abc import Awaitable, Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ApiErrorResponse, ErrorCode
from cdl_api.services.auth import AuthenticationService
from cdl_api.settings import Settings

_PUBLIC_STAGING_PATHS = {
    "/health",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/session",
}


def staging_access_required(settings: Settings, path: str) -> bool:
    """Return whether a staging request must have an application session."""
    if settings.environment != "staging":
        return False
    if path in _PUBLIC_STAGING_PATHS:
        return False
    return path.startswith(f"{settings.api_prefix}/") or path in {
        "/docs",
        "/openapi.json",
        "/redoc",
    }


def build_staging_access_middleware(
    settings: Settings,
    auth_service: AuthenticationService,
) -> Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]:
    """Build middleware that protects staging API and schema routes."""

    async def enforce_staging_access(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if staging_access_required(settings, request.url.path):
            session_id = request.cookies.get(settings.session_cookie_name)
            session = auth_service.get_session(session_id)
            if not session.is_authenticated:
                error = ApiErrorResponse(
                    code=ErrorCode.UNAUTHENTICATED,
                    message="Authentication required.",
                )
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content=error.model_dump(),
                )
        return await call_next(request)

    return enforce_staging_access
