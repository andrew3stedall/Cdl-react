"""Authentication API routes."""

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from cdl_api.contracts.auth import (
    GoogleAuthConfig,
    GoogleCredentialRequest,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
)
from cdl_api.contracts.common import ApiErrorResponse, ErrorCode
from cdl_api.contracts.session import SessionState, SessionUser
from cdl_api.google_identity import GoogleIdentityVerifier
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


def get_google_identity_verifier(
    settings: Settings = Depends(get_settings),
) -> GoogleIdentityVerifier:
    return GoogleIdentityVerifier(
        client_id=settings.google_client_id,
        allowed_emails=settings.google_allowed_email_set,
    )


def _session_id_from_request(request: Request, settings: Settings) -> str | None:
    return request.cookies.get(settings.session_cookie_name)


def _set_session_cookie(
    response: Response,
    settings: Settings,
    session_id: str,
) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_id,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )


def _database_unavailable(message: str) -> JSONResponse:
    error = ApiErrorResponse(
        code=ErrorCode.SERVER_ERROR,
        message=message,
    )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content=error.model_dump(),
    )


def require_authenticated_session(
    request: Request,
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
) -> SessionUser:
    try:
        session = service.get_session(_session_id_from_request(request, settings))
    except OperationalError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session verification is temporarily unavailable.",
        ) from exc
    if not session.is_authenticated or session.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return session.user


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    response: Response,
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
) -> LoginResponse | JSONResponse:
    try:
        result = service.login(payload)
    except OperationalError:
        return _database_unavailable("Sign in is temporarily unavailable. Try again.")
    if result is None:
        error = ApiErrorResponse(
            code=ErrorCode.UNAUTHENTICATED,
            message="Invalid email or password.",
        )
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content=error.model_dump())

    session_id, session = result
    _set_session_cookie(response, settings, session_id)
    return LoginResponse(session=session)


@router.get("/google/config", response_model=GoogleAuthConfig)
def google_config(settings: Settings = Depends(get_settings)) -> GoogleAuthConfig:
    return GoogleAuthConfig(
        enabled=settings.google_sign_in_enabled,
        client_id=settings.google_client_id if settings.google_sign_in_enabled else None,
    )


@router.post("/google", response_model=LoginResponse)
def google_login(
    payload: GoogleCredentialRequest,
    response: Response,
    google_sign_in_header: str | None = Header(default=None, alias="X-CDL-Google-Sign-In"),
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
    verifier: GoogleIdentityVerifier = Depends(get_google_identity_verifier),
) -> LoginResponse | JSONResponse:
    if google_sign_in_header != "1":
        error = ApiErrorResponse(
            code=ErrorCode.UNAUTHENTICATED,
            message="Google sign-in request was rejected.",
        )
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content=error.model_dump())

    identity = verifier.verify(payload.credential)
    if identity is None:
        error = ApiErrorResponse(
            code=ErrorCode.UNAUTHENTICATED,
            message="Google sign-in was not authorized.",
        )
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content=error.model_dump())

    try:
        session_id, session = service.login_google(identity)
    except OperationalError:
        return _database_unavailable("Google sign-in is temporarily unavailable. Try again.")
    _set_session_cookie(response, settings, session_id)
    return LoginResponse(session=session)


@router.get("/session", response_model=SessionState)
def session(
    request: Request,
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
) -> SessionState | JSONResponse:
    try:
        return service.get_session(_session_id_from_request(request, settings))
    except OperationalError:
        return _database_unavailable("Session verification is temporarily unavailable. Retry.")


@router.post("/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    response: Response,
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
) -> LogoutResponse | JSONResponse:
    try:
        session = service.logout(_session_id_from_request(request, settings))
    except OperationalError:
        return _database_unavailable("Sign out is temporarily unavailable. Try again.")
    response.delete_cookie(
        settings.session_cookie_name,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )
    return LogoutResponse(session=session)
