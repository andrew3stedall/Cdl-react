"""OAuth authorization server routes for external MCP clients."""

import hmac
import secrets
from html import escape
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse, JSONResponse

from cdl_api.contracts.oauth import (
    PUBLIC_CLIENT_AUTH_METHOD,
    OAuthClientRegistrationRequest,
    OAuthClientRegistrationResponse,
    OAuthConnectionResponse,
)
from cdl_api.contracts.session import SessionUser
from cdl_api.database import build_session_factory
from cdl_api.repositories.oauth import build_oauth_repository
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.services.oauth import OAuthError, OAuthService
from cdl_api.settings import Settings, get_settings

router = APIRouter(tags=["oauth"])
_CONSENT_COOKIE = "cdl_oauth_consent"
_CONSENT_CSP = " ".join(
    (
        "default-src 'none';",
        "form-action 'self';",
        "base-uri 'none';",
        "frame-ancestors 'none'",
    )
)


def get_oauth_service(settings: Settings = Depends(get_settings)) -> OAuthService:
    if not settings.mcp_oauth_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OAuth is disabled.")
    if not settings.oauth_signing_secret:
        raise HTTPException(status_code=503, detail="OAuth is not configured.")
    session_factory = (
        build_session_factory(settings) if settings.repository_mode == "postgres" else None
    )
    repository = build_oauth_repository(settings.repository_mode, session_factory)
    return OAuthService(repository, settings.oauth_issuer_url, settings.oauth_signing_secret)


def _error(error: OAuthError, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": error.error, "error_description": error.description},
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


def _append_query(uri: str, values: dict[str, str]) -> str:
    parsed = urlsplit(uri)
    old = parse_qs(parsed.query, keep_blank_values=True)
    old.update({key: [value] for key, value in values.items()})
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(old, doseq=True), ""))


@router.get("/.well-known/oauth-authorization-server")
def authorization_server_metadata(
    settings: Settings = Depends(get_settings),
) -> dict[str, object]:
    if not settings.mcp_oauth_enabled:
        raise HTTPException(status_code=404, detail="OAuth is disabled.")
    issuer = settings.oauth_issuer_url.rstrip("/")
    return {
        "issuer": issuer,
        "authorization_endpoint": f"{issuer}/oauth/authorize",
        "token_endpoint": f"{issuer}/oauth/token",
        "revocation_endpoint": f"{issuer}/oauth/revoke",
        "registration_endpoint": f"{issuer}/oauth/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "revocation_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": ["cdl:read", "cdl:write", "offline_access"],
        "authorization_response_iss_parameter_supported": True,
        "service_documentation": f"{issuer}/docs",
    }


@router.post(
    "/oauth/register",
    response_model=OAuthClientRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_client(
    payload: OAuthClientRegistrationRequest,
    service: OAuthService = Depends(get_oauth_service),
) -> OAuthClientRegistrationResponse:
    if (
        payload.grant_types != ["authorization_code", "refresh_token"]
        or payload.response_types != ["code"]
        or payload.token_endpoint_auth_method != PUBLIC_CLIENT_AUTH_METHOD
    ):
        raise HTTPException(
            status_code=400, detail="Only public authorization-code clients are supported."
        )
    try:
        client = service.register_client(payload.client_name, payload.redirect_uris)
    except OAuthError as exc:
        return _error(exc)
    return OAuthClientRegistrationResponse(
        client_id=str(client["client_id"]),
        client_name=str(client["client_name"]),
        redirect_uris=list(client["redirect_uris"]),
        grant_types=payload.grant_types,
        response_types=payload.response_types,
        token_endpoint_auth_method=PUBLIC_CLIENT_AUTH_METHOD,
    )


@router.get("/oauth/authorize", response_class=HTMLResponse)
def authorize(
    client_id: str,
    redirect_uri: str,
    response_type: str,
    scope: str,
    state: str,
    code_challenge: str,
    code_challenge_method: str,
    settings: Settings = Depends(get_settings),
    user: SessionUser = Depends(require_authenticated_session),
    service: OAuthService = Depends(get_oauth_service),
) -> Response:
    del user
    try:
        client, scopes = service.authorize_request(
            client_id=client_id,
            redirect_uri=redirect_uri,
            response_type=response_type,
            scope=scope,
            state=state,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
        )
    except OAuthError as exc:
        return _error(exc)
    csrf_token = secrets.token_urlsafe(32)
    hidden = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": response_type,
        "scope": " ".join(scopes),
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": code_challenge_method,
        "csrf_token": csrf_token,
    }
    fields = "".join(
        f'<input type="hidden" name="{escape(key)}" value="{escape(value)}">'
        for key, value in hidden.items()
    )
    scope_list = "".join(
        "<li><label><input type='checkbox' name='grant_scope' "
        f"value='{escape(item)}' checked> {escape(item)}</label></li>"
        for item in scopes
    )
    callback_host = escape(urlsplit(redirect_uri).hostname or "unknown host")
    response = HTMLResponse(
        "<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' "
        "content='width=device-width,initial-scale=1'><title>Connect AI assistant</title>"
        "<main><h1>Connect AI assistant</h1><p>"
        f"<strong>{escape(str(client['client_name']))}</strong> requests access "
        "to your CDL account. "
        f"This name is supplied by the assistant and is not verified. The approval will return "
        f"to <strong>{callback_host}</strong>.</p>"
        f"<ul>{scope_list}</ul><form method='post' action='/oauth/authorize/decision'>"
        f"{fields}<button name='decision' value='allow'>Allow</button>"
        "<button name='decision' value='deny'>Deny</button></form></main></html>",
        headers={
            "Cache-Control": "no-store",
            "Content-Security-Policy": _CONSENT_CSP,
            "Referrer-Policy": "no-referrer",
            "X-Frame-Options": "DENY",
        },
    )
    response.set_cookie(
        _CONSENT_COOKIE,
        csrf_token,
        max_age=300,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/oauth",
    )
    return response


@router.post("/oauth/authorize/decision")
async def authorize_decision(
    request: Request,
    user: SessionUser = Depends(require_authenticated_session),
    service: OAuthService = Depends(get_oauth_service),
) -> Response:
    form = parse_qs((await request.body()).decode(), keep_blank_values=True)
    data = {key: values[-1] for key, values in form.items()}
    requested_scope = data.get("scope", "")
    selected_scopes = form.get("grant_scope", [])
    csrf_cookie = request.cookies.get(_CONSENT_COOKIE, "")
    csrf_form = data.pop("csrf_token", "")
    if not csrf_cookie or not hmac.compare_digest(csrf_cookie, csrf_form):
        raise HTTPException(
            status_code=400, detail="Consent form expired. Restart the connection flow."
        )
    response = Response(status_code=302, headers={"Cache-Control": "no-store"})
    response.delete_cookie(_CONSENT_COOKIE, path="/oauth")
    redirect_uri = data.get("redirect_uri", "")
    try:
        client, scopes = service.authorize_request(
            client_id=data.get("client_id", ""),
            redirect_uri=redirect_uri,
            response_type=data.get("response_type", ""),
            scope=requested_scope,
            state=data.get("state"),
            code_challenge=data.get("code_challenge", ""),
            code_challenge_method=data.get("code_challenge_method", ""),
        )
    except OAuthError as exc:
        return _error(exc)
    if not set(selected_scopes).issubset(set(scopes)):
        return _error(
            OAuthError("invalid_scope", "Selected scopes must be a subset of the request.")
        )
    if data.get("decision") != "allow":
        response.headers["Location"] = _append_query(
            redirect_uri,
            {
                "error": "access_denied",
                "state": data.get("state", ""),
                "iss": service.issuer,
            },
        )
        return response
    if not selected_scopes:
        response.headers["Location"] = _append_query(
            redirect_uri,
            {
                "error": "access_denied",
                "state": data.get("state", ""),
                "iss": service.issuer,
            },
        )
        return response
    code = service.issue_code(
        user_id=user.id,
        client_id=str(client["client_id"]),
        redirect_uri=redirect_uri,
        scopes=sorted(set(selected_scopes)),
        code_challenge=data["code_challenge"],
    )
    response.headers["Location"] = _append_query(
        redirect_uri, {"code": code, "state": data["state"], "iss": service.issuer}
    )
    return response


@router.post("/oauth/token")
async def token(
    request: Request, service: OAuthService = Depends(get_oauth_service)
) -> JSONResponse:
    form = {
        key: values[-1]
        for key, values in parse_qs((await request.body()).decode(), keep_blank_values=True).items()
    }
    client_id = form.get("client_id", "")
    try:
        grant_type = form.get("grant_type")
        if grant_type == "authorization_code":
            result = service.exchange_code(
                client_id=client_id,
                code=form.get("code", ""),
                redirect_uri=form.get("redirect_uri", ""),
                code_verifier=form.get("code_verifier", ""),
            )
        elif grant_type == "refresh_token":
            result = service.refresh(
                client_id=client_id, refresh_token=form.get("refresh_token", "")
            )
        else:
            raise OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.")
    except OAuthError as exc:
        return _error(exc, 401 if exc.error == "invalid_client" else 400)
    return JSONResponse(result, headers={"Cache-Control": "no-store", "Pragma": "no-cache"})


@router.post("/oauth/revoke", status_code=200)
async def revoke(request: Request, service: OAuthService = Depends(get_oauth_service)) -> Response:
    form = {
        key: values[-1]
        for key, values in parse_qs((await request.body()).decode(), keep_blank_values=True).items()
    }
    service.revoke_token(form.get("token", ""), client_id=form.get("client_id", ""))
    return Response(status_code=200, headers={"Cache-Control": "no-store"})


@router.get("/oauth/connections", response_model=list[OAuthConnectionResponse])
def list_connections(
    user: SessionUser = Depends(require_authenticated_session),
    service: OAuthService = Depends(get_oauth_service),
) -> list[OAuthConnectionResponse]:
    return [OAuthConnectionResponse(**row) for row in service.list_connections(user.id)]


@router.delete("/oauth/connections/{connection_id}", status_code=204)
def revoke_connection(
    connection_id: str,
    user: SessionUser = Depends(require_authenticated_session),
    service: OAuthService = Depends(get_oauth_service),
) -> Response:
    if not service.revoke_connection(connection_id, user.id):
        raise HTTPException(status_code=404, detail="Connection not found.")
    return Response(status_code=204)
