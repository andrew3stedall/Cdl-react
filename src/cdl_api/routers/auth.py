"""Authentication API routes."""

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.auth import LoginRequest, LoginResponse, LogoutResponse
from cdl_api.contracts.common import ApiErrorResponse, ErrorCode
from cdl_api.contracts.session import SessionState
from cdl_api.repositories.factory import build_repositories
from cdl_api.services.auth import AuthenticationService
from cdl_api.settings import Settings, get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(settings: Settings = Depends(get_settings)) -> AuthenticationService:
    repositories = build_repositories(settings)
    return AuthenticationService(
        repositories.users,
        repositories.sessions,
        settings.development_login_secret,
    )


def _session_id_from_request(request: Request, settings: Settings) -> str | None:
    return request.cookies.get(settings.session_cookie_name)


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    response: Response,
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
) -> LoginResponse | JSONResponse:
    result = service.login(payload)
    if result is None:
        error = ApiErrorResponse(
            code=ErrorCode.UNAUTHENTICATED,
            message="Invalid email or password.",
        )
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content=error.model_dump())

    session_id, session = result
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_id,
        httponly=True,
        samesite="lax",
    )
    return LoginResponse(session=session)


@router.get("/session", response_model=SessionState)
def session(
    request: Request,
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
) -> SessionState:
    return service.get_session(_session_id_from_request(request, settings))


@router.post("/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    response: Response,
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
) -> LogoutResponse:
    session = service.logout(_session_id_from_request(request, settings))
    response.delete_cookie(settings.session_cookie_name)
    return LogoutResponse(session=session)
