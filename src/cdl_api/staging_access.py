"""Staging-only application login boundary for public Cloud Run invocation."""

from collections.abc import Awaitable, Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError

from cdl_api.contracts.common import ApiErrorResponse, ErrorCode
from cdl_api.services.auth import AuthenticationService
from cdl_api.settings import Settings

_PUBLIC_AUTH_PATHS = {
    "/health",
    "/api/auth/login",
    "/api/auth/google",
    "/api/auth/google/config",
    "/api/auth/apple/config",
    "/api/auth/apple/start",
    "/api/auth/apple/callback",
    "/api/auth/passkeys/config",
    "/api/auth/passkeys/authentication/options",
    "/api/auth/passkeys/authentication",
    "/api/auth/logout",
    "/api/auth/session",
}


def staging_access_required(settings: Settings, path: str) -> bool:
    """Return whether a protected-environment request needs an application session."""
    if not settings.is_protected_environment:
        return False
    if path.startswith(f"{settings.api_prefix}/league/invites/"):
        return False
    if path in _PUBLIC_AUTH_PATHS:
        return False
    return path.startswith(f"{settings.api_prefix}/") or path in {
        "/docs",
        "/openapi.json",
        "/redoc",
    }


def build_staging_access_middleware(
    settings: Settings,
    auth_service: AuthenticationService,
    membership_repository: object | None = None,
) -> Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]:
    """Build middleware that protects staging and production API/schema routes."""

    async def enforce_staging_access(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if settings.environment == "production" and request.url.path.startswith(
            f"{settings.api_prefix}/modernisation/"
        ):
            error = ApiErrorResponse(
                code=ErrorCode.NOT_FOUND,
                message="This engineering preview is unavailable in production.",
            )
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=error.model_dump())
        if staging_access_required(settings, request.url.path):
            session_id = request.cookies.get(settings.session_cookie_name)
            try:
                session = auth_service.get_session(session_id)
            except (OperationalError, SQLAlchemyTimeoutError):
                error = ApiErrorResponse(
                    code=ErrorCode.SERVER_ERROR,
                    message="Session verification is temporarily unavailable. Retry.",
                )
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content=error.model_dump(),
                )
            request.state.authenticated_session = session
            if not session.is_authenticated:
                error = ApiErrorResponse(
                    code=ErrorCode.UNAUTHENTICATED,
                    message="Authentication required.",
                )
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content=error.model_dump(),
                )
            if (
                settings.repository_mode == "postgres"
                and membership_repository is not None
                and not path_is_onboarding(request.url.path, settings.api_prefix)
            ):
                try:
                    access = membership_repository.access_for_user(session.user.id)
                except (OperationalError, SQLAlchemyTimeoutError):
                    error = ApiErrorResponse(
                        code=ErrorCode.SERVER_ERROR,
                        message="League access is temporarily unavailable. Retry.",
                    )
                    return JSONResponse(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        content=error.model_dump(),
                    )
                if access is None or access.team_id is None:
                    error = ApiErrorResponse(
                        code=ErrorCode.FORBIDDEN,
                        message="A team assignment is required before opening this page.",
                    )
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content=error.model_dump(),
                    )
        return await call_next(request)

    return enforce_staging_access


def path_is_onboarding(path: str, api_prefix: str) -> bool:
    """Allow auth setup and invite acceptance before manager assignment exists."""
    if path.startswith(f"{api_prefix}/auth/"):
        return True
    return path.startswith(f"{api_prefix}/league/invites/")
