"""CDL-hosted manual execution grants, exact-action approvals, and AI activity."""

import hmac
import json
import secrets
from datetime import UTC, datetime
from html import escape
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from cdl_api.contracts.session import SessionUser
from cdl_api.database import build_session_factory
from cdl_api.repositories.ai_execution import build_ai_execution_repository
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.oauth import get_oauth_service
from cdl_api.services.ai_execution import AIExecutionPolicy
from cdl_api.services.oauth import OAuthService
from cdl_api.settings import Settings, get_settings

router = APIRouter(tags=["ai-execution"])
_CSRF_COOKIE = "cdl_ai_approval_csrf"
_CSP = "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"


class ExecutionGrantRequest(BaseModel):
    connection_id: str = Field(min_length=1, max_length=64)


class ApprovalDecision(BaseModel):
    csrf_token: str
    decision: str


def get_ai_execution_policy(settings: Settings = Depends(get_settings)) -> AIExecutionPolicy:
    factory = build_session_factory(settings) if settings.repository_mode == "postgres" else None
    repository = build_ai_execution_repository(settings.repository_mode, factory)
    return AIExecutionPolicy(repository)


def _require_enabled(settings: Settings) -> None:
    if not settings.mcp_execution_enabled:
        raise HTTPException(status_code=404, detail="AI execution controls are disabled.")


def _require_owned_connection(
    settings: Settings, user: SessionUser, connection_id: str, service: OAuthService
) -> None:
    if settings.mcp_browser_enabled and connection_id == f"browser:{user.id}":
        return
    if connection_id not in {row.id for row in service.list_connections(user.id)}:
        raise HTTPException(status_code=404, detail="AI connection not found.")


@router.post("/ai/execution-grants")
def activate_execution_grant(
    payload: ExecutionGrantRequest,
    settings: Settings = Depends(get_settings),
    user: SessionUser = Depends(require_authenticated_session),
    oauth: OAuthService = Depends(get_oauth_service),
    policy: AIExecutionPolicy = Depends(get_ai_execution_policy),
) -> dict[str, object]:
    _require_enabled(settings)
    _require_owned_connection(settings, user, payload.connection_id, oauth)
    grant = policy.activate(user.id, payload.connection_id)
    policy.record_activity(
        user_id=user.id,
        connection_id=payload.connection_id,
        tool_name="execution_grant.activate",
        risk="consequential",
        outcome="success",
        arguments={"connection_id": payload.connection_id},
    )
    return grant


@router.get("/ai/execution-grants/{connection_id}")
def get_execution_grant(
    connection_id: str,
    settings: Settings = Depends(get_settings),
    user: SessionUser = Depends(require_authenticated_session),
    oauth: OAuthService = Depends(get_oauth_service),
    policy: AIExecutionPolicy = Depends(get_ai_execution_policy),
) -> dict[str, object]:
    _require_enabled(settings)
    _require_owned_connection(settings, user, connection_id, oauth)
    grant = policy.active_grant(user.id, connection_id)
    return {"active": grant is not None, "grant": grant}


@router.delete("/ai/execution-grants/{connection_id}", status_code=204)
def revoke_execution_grant(
    connection_id: str,
    settings: Settings = Depends(get_settings),
    user: SessionUser = Depends(require_authenticated_session),
    oauth: OAuthService = Depends(get_oauth_service),
    policy: AIExecutionPolicy = Depends(get_ai_execution_policy),
) -> Response:
    _require_enabled(settings)
    _require_owned_connection(settings, user, connection_id, oauth)
    policy.revoke(user.id, connection_id)
    policy.record_activity(
        user_id=user.id,
        connection_id=connection_id,
        tool_name="execution_grant.revoke",
        risk="consequential",
        outcome="success",
        arguments={"connection_id": connection_id},
    )
    return Response(status_code=204)


@router.get("/ai/activity")
def list_ai_activity(
    limit: int = Query(default=50, ge=1, le=100),
    settings: Settings = Depends(get_settings),
    user: SessionUser = Depends(require_authenticated_session),
    policy: AIExecutionPolicy = Depends(get_ai_execution_policy),
) -> list[dict[str, object]]:
    _require_enabled(settings)
    return policy.activity(user.id, limit)


@router.get("/ai-approvals/{proposal_id}", response_class=HTMLResponse)
def approval_page(
    proposal_id: str,
    settings: Settings = Depends(get_settings),
    user: SessionUser = Depends(require_authenticated_session),
    policy: AIExecutionPolicy = Depends(get_ai_execution_policy),
) -> Response:
    _require_enabled(settings)
    proposal = policy.get_proposal(proposal_id, user.id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Approval request not found.")
    csrf = secrets.token_urlsafe(32)
    serialized = escape(json.dumps(proposal["arguments"], indent=2, sort_keys=True))
    if proposal["expires_at"] <= datetime.now(UTC) or proposal["status"] != "pending":
        content = f"<p>This request is {escape(proposal['status'])} or expired.</p>"
    else:
        content = (
            f"<p>Assistant connection <code>{escape(proposal['connection_id'])}</code> requests "
            f"<strong>{escape(proposal['tool_name'])}</strong>.</p>"
            f"<p>Action parameters:</p><pre>{serialized}</pre>"
            f"<p>Expires at {escape(proposal['expires_at'].isoformat())}.</p>"
            f"<form method='post' action='{settings.api_prefix}/ai-approvals/"
            f"{escape(proposal_id)}/decision'>"
            "<input type='hidden' name='csrf_token' "
            f"value='{escape(csrf)}'><button name='decision' value='approve'>"
            "Approve this exact action</button> "
            "<button name='decision' value='reject'>Reject</button></form>"
        )
    response = HTMLResponse(
        "<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' "
        "content='width=device-width,initial-scale=1'><title>Approve AI action</title>"
        f"<main><h1>Approve AI action</h1>{content}</main></html>",
        headers={
            "Cache-Control": "no-store",
            "Content-Security-Policy": _CSP,
            "Referrer-Policy": "no-referrer",
            "X-Frame-Options": "DENY",
        },
    )
    response.set_cookie(
        _CSRF_COOKIE,
        csrf,
        max_age=300,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path=f"{settings.api_prefix}/ai-approvals",
    )
    return response


@router.post("/ai-approvals/{proposal_id}/decision")
async def decide_ai_approval(
    proposal_id: str,
    request: Request,
    settings: Settings = Depends(get_settings),
    user: SessionUser = Depends(require_authenticated_session),
    policy: AIExecutionPolicy = Depends(get_ai_execution_policy),
) -> Response:
    _require_enabled(settings)
    form = parse_qs((await request.body()).decode(), keep_blank_values=True)
    csrf_form = form.get("csrf_token", [""])[-1]
    csrf_cookie = request.cookies.get(_CSRF_COOKIE, "")
    if not csrf_cookie or not hmac.compare_digest(csrf_cookie, csrf_form):
        raise HTTPException(status_code=400, detail="Approval form expired. Reload the page.")
    decision = form.get("decision", [""])[-1]
    if decision not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="Choose approve or reject.")
    operation = policy.approve if decision == "approve" else policy.reject
    if not operation(proposal_id, user.id):
        raise HTTPException(
            status_code=409, detail="Approval is expired, already decided, or not yours."
        )
    proposal = policy.get_proposal(proposal_id, user.id)
    if proposal is not None:
        policy.record_activity(
            user_id=user.id,
            connection_id=proposal["connection_id"],
            tool_name=proposal["tool_name"],
            risk="consequential",
            outcome="approval_approved" if decision == "approve" else "approval_rejected",
            arguments=proposal["arguments"],
        )
    response = HTMLResponse(
        "<!doctype html><html lang='en'><meta charset='utf-8'><main><h1>Decision saved</h1>"
        f"<p>The exact action was {escape(decision)}.</p></main></html>",
        headers={"Cache-Control": "no-store", "Content-Security-Policy": _CSP},
    )
    response.delete_cookie(_CSRF_COOKIE, path=f"{settings.api_prefix}/ai-approvals")
    return response
