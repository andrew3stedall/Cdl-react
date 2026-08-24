"""Authentication API routes."""

import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.exc import OperationalError
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError

from cdl_api.apple_identity import AppleIdentityVerifier
from cdl_api.contracts.auth import (
    AppleAuthConfig,
    GoogleAuthConfig,
    GoogleCredentialRequest,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    PasskeyAuthConfig,
    PasskeyCredentialRequest,
)
from cdl_api.contracts.common import ApiErrorResponse, ErrorCode
from cdl_api.contracts.session import SessionState, SessionUser
from cdl_api.google_identity import GoogleIdentityVerifier
from cdl_api.repositories.factory import build_repositories
from cdl_api.services.auth import AuthenticationService
from cdl_api.services.passkeys import PasskeyError, PasskeyService
from cdl_api.settings import Settings, get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

PASSKEY_CHALLENGE_COOKIE = "cdl_passkey_challenge"
APPLE_STATE_COOKIE = "cdl_apple_state"
APPLE_NONCE_COOKIE = "cdl_apple_nonce"


def get_auth_service(settings: Settings = Depends(get_settings)) -> AuthenticationService:
    repositories = build_repositories(settings)
    return AuthenticationService(
        repositories.users,
        repositories.sessions,
        settings.development_login_secret,
        settings.session_ttl_days,
    )


def get_google_identity_verifier(
    settings: Settings = Depends(get_settings),
) -> GoogleIdentityVerifier:
    return GoogleIdentityVerifier(
        client_id=settings.google_client_id,
        allowed_emails=settings.google_allowed_email_set,
    )


def get_apple_identity_verifier(
    settings: Settings = Depends(get_settings),
) -> AppleIdentityVerifier:
    return AppleIdentityVerifier(
        client_id=settings.apple_client_id,
        team_id=settings.apple_team_id,
        key_id=settings.apple_key_id,
        private_key=settings.apple_private_key,
        redirect_uri=settings.apple_redirect_uri,
        allowed_emails=settings.apple_allowed_email_set,
    )


def get_passkey_service(settings: Settings = Depends(get_settings)) -> PasskeyService:
    repositories = build_repositories(settings)
    return PasskeyService(
        repositories.passkeys,
        repositories.auth_challenges,
        repositories.users,
        rp_id=settings.passkey_rp_id,
        rp_name=settings.passkey_rp_name,
        expected_origin=settings.passkey_expected_origin,
    )


def _session_id_from_request(request: Request, settings: Settings) -> str | None:
    return request.cookies.get(settings.session_cookie_name)


def get_session_for_request(
    request: Request,
    settings: Settings,
    service: AuthenticationService,
) -> SessionState:
    """Reuse staging middleware's session lookup when one is already available."""
    cached_session = getattr(request.state, "authenticated_session", None)
    if isinstance(cached_session, SessionState):
        return cached_session
    return service.get_session(_session_id_from_request(request, settings))


def _set_session_cookie(
    response: Response,
    settings: Settings,
    session_id: str,
) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_id,
        httponly=True,
        max_age=settings.session_ttl_days * 24 * 60 * 60,
        path="/",
        secure=settings.session_cookie_secure,
        samesite="lax",
    )


def _set_short_lived_cookie(response: Response, key: str, value: str, settings: Settings) -> None:
    response.set_cookie(
        key=key,
        value=value,
        httponly=True,
        max_age=300,
        path="/",
        secure=settings.session_cookie_secure,
        samesite="lax",
    )


def _clear_cookie(response: Response, key: str, settings: Settings) -> None:
    response.delete_cookie(
        key,
        path="/",
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
        session = get_session_for_request(request, settings, service)
    except (OperationalError, SQLAlchemyTimeoutError) as exc:
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


def get_optional_authenticated_session(
    request: Request,
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
) -> SessionUser | None:
    """Return the current user when present without changing public dev routes.

    Staging's middleware already rejects anonymous API requests. Keeping this
    dependency optional preserves the unauthenticated in-memory preview while
    allowing PostgreSQL-backed repositories to select the signed-in manager's
    team in staging.
    """
    try:
        session = get_session_for_request(request, settings, service)
    except (OperationalError, SQLAlchemyTimeoutError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session verification is temporarily unavailable.",
        ) from exc
    return session.user if session.is_authenticated else None


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    response: Response,
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
) -> LoginResponse | JSONResponse:
    try:
        result = service.login(payload)
    except (OperationalError, SQLAlchemyTimeoutError):
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


@router.get("/apple/config", response_model=AppleAuthConfig)
def apple_config(
    verifier: AppleIdentityVerifier = Depends(get_apple_identity_verifier),
) -> AppleAuthConfig:
    return AppleAuthConfig(enabled=verifier.enabled)


@router.get("/apple/start")
def apple_start(
    response: Response,
    settings: Settings = Depends(get_settings),
    verifier: AppleIdentityVerifier = Depends(get_apple_identity_verifier),
) -> Response:
    if not verifier.enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apple sign-in is unavailable.",
        )
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    redirect = RedirectResponse(
        verifier.authorization_url(state, nonce),
        status_code=status.HTTP_303_SEE_OTHER,
    )
    _set_short_lived_cookie(redirect, APPLE_STATE_COOKIE, state, settings)
    _set_short_lived_cookie(redirect, APPLE_NONCE_COOKIE, nonce, settings)
    return redirect


@router.get("/apple/callback")
def apple_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
    verifier: AppleIdentityVerifier = Depends(get_apple_identity_verifier),
) -> Response:
    state_cookie = request.cookies.get(APPLE_STATE_COOKIE)
    nonce = request.cookies.get(APPLE_NONCE_COOKIE)
    if not code or not state or not secrets.compare_digest(state, state_cookie or "") or not nonce:
        return RedirectResponse("/login?auth_error=apple", status_code=status.HTTP_303_SEE_OTHER)

    identity = verifier.verify_code(code=code, nonce=nonce)
    if identity is None:
        return RedirectResponse("/login?auth_error=apple", status_code=status.HTTP_303_SEE_OTHER)

    try:
        session_id, _ = service.login_apple(identity)
    except (OperationalError, SQLAlchemyTimeoutError):
        return RedirectResponse("/login?auth_error=apple", status_code=status.HTTP_303_SEE_OTHER)

    redirect = RedirectResponse("/", status_code=status.HTTP_303_SEE_OTHER)
    _set_session_cookie(redirect, settings, session_id)
    _clear_cookie(redirect, APPLE_STATE_COOKIE, settings)
    _clear_cookie(redirect, APPLE_NONCE_COOKIE, settings)
    redirect.headers["X-CDL-Auth-Provider"] = "apple"
    return redirect


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
    except (OperationalError, SQLAlchemyTimeoutError):
        return _database_unavailable("Google sign-in is temporarily unavailable. Try again.")
    _set_session_cookie(response, settings, session_id)
    return LoginResponse(session=session)


@router.get("/passkeys/config", response_model=PasskeyAuthConfig)
def passkey_config(
    settings: Settings = Depends(get_settings),
) -> PasskeyAuthConfig:
    return PasskeyAuthConfig(
        enabled=settings.passkey_enabled,
        rp_id=settings.passkey_rp_id if settings.passkey_enabled else None,
    )


@router.get("/passkeys/authentication/options")
def passkey_authentication_options(
    response: Response,
    settings: Settings = Depends(get_settings),
    service: PasskeyService = Depends(get_passkey_service),
) -> Response:
    try:
        options, challenge_id = service.authentication_options()
    except PasskeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    result = JSONResponse(content=options)
    _set_short_lived_cookie(result, PASSKEY_CHALLENGE_COOKIE, challenge_id, settings)
    return result


@router.post("/passkeys/authentication", response_model=LoginResponse)
def passkey_authentication(
    payload: PasskeyCredentialRequest,
    request: Request,
    response: Response,
    settings: Settings = Depends(get_settings),
    auth_service: AuthenticationService = Depends(get_auth_service),
    passkey_service: PasskeyService = Depends(get_passkey_service),
) -> LoginResponse | JSONResponse:
    try:
        user = passkey_service.verify_authentication(
            challenge_id=request.cookies.get(PASSKEY_CHALLENGE_COOKIE),
            credential=payload.credential,
        )
        session_id, session = auth_service.login_user(user)
    except PasskeyError:
        error = ApiErrorResponse(
            code=ErrorCode.UNAUTHENTICATED,
            message="Passkey sign-in could not be verified. Try another sign-in method.",
        )
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content=error.model_dump())
    except (OperationalError, SQLAlchemyTimeoutError):
        return _database_unavailable("Passkey sign-in is temporarily unavailable. Try again.")

    _set_session_cookie(response, settings, session_id)
    _clear_cookie(response, PASSKEY_CHALLENGE_COOKIE, settings)
    return LoginResponse(session=session)


@router.get("/passkeys/registration/options")
def passkey_registration_options(
    response: Response,
    user: SessionUser = Depends(require_authenticated_session),
    settings: Settings = Depends(get_settings),
    service: PasskeyService = Depends(get_passkey_service),
) -> Response:
    try:
        options, challenge_id = service.registration_options(
            user.id,
            user.email,
            user.display_name,
        )
    except PasskeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    result = JSONResponse(content=options)
    _set_short_lived_cookie(result, PASSKEY_CHALLENGE_COOKIE, challenge_id, settings)
    return result


@router.post("/passkeys/registration", response_model=None)
def passkey_registration(
    payload: PasskeyCredentialRequest,
    request: Request,
    response: Response,
    user: SessionUser = Depends(require_authenticated_session),
    settings: Settings = Depends(get_settings),
    service: PasskeyService = Depends(get_passkey_service),
) -> dict[str, object] | JSONResponse:
    try:
        record = service.verify_registration(
            challenge_id=request.cookies.get(PASSKEY_CHALLENGE_COOKIE),
            user_id=user.id,
            credential=payload.credential,
        )
    except PasskeyError as exc:
        error = ApiErrorResponse(code=ErrorCode.VALIDATION_ERROR, message=str(exc))
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=error.model_dump())
    _clear_cookie(response, PASSKEY_CHALLENGE_COOKIE, settings)
    return {"registered": True, "credential_id": record.credential_id}


@router.get("/passkeys/status")
def passkey_status(
    user: SessionUser = Depends(require_authenticated_session),
    service: PasskeyService = Depends(get_passkey_service),
) -> dict[str, object]:
    return {
        "enabled": service.enabled,
        "registered_count": service.registered_count(user.id) if service.enabled else 0,
    }


@router.get("/session", response_model=SessionState)
def session(
    request: Request,
    settings: Settings = Depends(get_settings),
    service: AuthenticationService = Depends(get_auth_service),
) -> SessionState | JSONResponse:
    try:
        return service.get_session(_session_id_from_request(request, settings))
    except (OperationalError, SQLAlchemyTimeoutError):
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
    except (OperationalError, SQLAlchemyTimeoutError):
        return _database_unavailable("Sign out is temporarily unavailable. Try again.")
    response.delete_cookie(
        settings.session_cookie_name,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )
    return LogoutResponse(session=session)
