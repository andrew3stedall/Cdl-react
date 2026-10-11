"""Stateless Streamable HTTP MCP and same-origin browser WebMCP routes."""

import base64
import binascii
import hashlib
import hmac
import json
from typing import Any
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from cdl_api.ai_tools.registry import TOOL_REGISTRY, ToolDefinition, ToolRisk
from cdl_api.contracts.session import SessionUser
from cdl_api.database import build_session_factory
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.oauth import get_oauth_service
from cdl_api.services.ai_tools import ToolExecutor, build_tool_executor
from cdl_api.services.mcp_sessions import (
    InMemoryMCPSessionStore,
    PostgreSQLMCPSessionStore,
    get_mcp_session_store,
)
from cdl_api.services.oauth import OAuthError, OAuthService
from cdl_api.settings import Settings, get_settings

router = APIRouter(tags=["mcp"])
PROTOCOL_VERSION = "2025-11-25"
_TOOLS = {tool.name: tool for tool in TOOL_REGISTRY}


def get_tool_executor(settings: Settings = Depends(get_settings)) -> ToolExecutor:
    return build_tool_executor(settings)


def _tool_payload(tool: ToolDefinition) -> dict[str, Any]:
    return {
        "name": tool.name,
        "title": tool.title,
        "description": tool.description,
        "inputSchema": tool.input_schema,
        "outputSchema": tool.response_schema,
        "annotations": {
            "readOnlyHint": tool.risk is ToolRisk.READ,
            "consequentialHint": tool.risk is ToolRisk.CONSEQUENTIAL,
            "untrustedContentHint": True,
        },
    }


def _jsonrpc(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _rpc_error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def _headers(accept: str, content_type: str) -> None:
    accepted = {part.split(";", 1)[0].strip() for part in accept.split(",")}
    if not {"application/json", "text/event-stream"}.issubset(accepted):
        raise HTTPException(
            status_code=406,
            detail="Accept must include application/json and text/event-stream.",
        )
    if "application/json" not in content_type:
        raise HTTPException(status_code=415, detail="MCP requests must use application/json.")


def _session_store(
    settings: Settings,
) -> InMemoryMCPSessionStore | PostgreSQLMCPSessionStore:
    factory = build_session_factory(settings) if settings.repository_mode == "postgres" else None
    return get_mcp_session_store(settings.repository_mode, factory)


def _bearer_token(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=401,
            detail="A CDL OAuth bearer token is required.",
            headers={
                "WWW-Authenticate": (
                    'Bearer resource_metadata="/.well-known/oauth-protected-resource"'
                )
            },
        )
    return token


def _visible_tools(scopes: set[str]) -> list[ToolDefinition]:
    return [
        tool
        for tool in sorted(TOOL_REGISTRY, key=lambda item: item.name)
        if {scope.value for scope in tool.scopes}.issubset(scopes)
    ]


def _validate_schema(value: Any, schema: dict[str, Any], path: str = "arguments") -> list[str]:
    errors: list[str] = []
    expected = schema.get("type")
    types = expected if isinstance(expected, list) else [expected]
    if expected:
        checks = {
            "object": lambda v: isinstance(v, dict),
            "array": lambda v: isinstance(v, list),
            "string": lambda v: isinstance(v, str),
            "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
            "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
            "boolean": lambda v: isinstance(v, bool),
            "null": lambda v: v is None,
        }
        if not any(checks.get(kind, lambda _: False)(value) for kind in types):
            return [f"{path} must match schema type {expected}."]
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path} must be one of the allowed values.")
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            errors.append(f"{path} is too short.")
        if len(value) > schema.get("maxLength", 1_000_000):
            errors.append(f"{path} is too long.")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if value < schema.get("minimum", float("-inf")) or value > schema.get(
            "maximum", float("inf")
        ):
            errors.append(f"{path} is outside the allowed range.")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{path} requires more items.")
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(value):
                errors.extend(_validate_schema(item, item_schema, f"{path}[{index}]"))
    if isinstance(value, dict):
        properties = schema.get("properties", {})
        for name in schema.get("required", []):
            if name not in value:
                errors.append(f"{path}.{name} is required.")
        if schema.get("additionalProperties") is False:
            errors.extend(
                f"{path}.{name} is not an allowed argument."
                for name in value
                if name not in properties
            )
        for name, item in value.items():
            if name in properties:
                errors.extend(_validate_schema(item, properties[name], f"{path}.{name}"))
    for branch in schema.get("allOf", []):
        condition = branch.get("if", {}).get("properties", {})
        if (
            condition
            and isinstance(value, dict)
            and all(value.get(k) == v.get("const") for k, v in condition.items())
        ):
            for name in branch.get("then", {}).get("required", []):
                if name not in value:
                    errors.append(f"{path}.{name} is conditionally required.")
    return errors


def _cursor_decode(cursor: str | None, tool: str, user_id: str, key: str) -> int:
    if not cursor:
        return 0
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4))
        payload, signature = raw.rsplit(b".", 1)
        expected = hmac.new(key.encode(), payload, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        data = json.loads(payload)
        if data["tool"] != tool or data["user"] != user_id:
            raise ValueError
        offset = data["offset"]
        if not isinstance(offset, int) or offset < 0:
            raise ValueError
        return offset
    except (ValueError, KeyError, TypeError, binascii.Error, json.JSONDecodeError) as exc:
        raise ValueError("Pagination cursor is invalid for this tool or user.") from exc


def _cursor_encode(offset: int, tool: str, user_id: str, key: str) -> str:
    payload = json.dumps(
        {"offset": offset, "tool": tool, "user": user_id}, separators=(",", ":")
    ).encode()
    signature = hmac.new(key.encode(), payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(payload + b"." + signature).decode().rstrip("=")


def _call_tool(
    tool: ToolDefinition,
    arguments: Any,
    *,
    user_id: str,
    connection_id: str | None,
    executor: ToolExecutor,
    signing_key: str,
) -> dict[str, Any]:
    if not isinstance(arguments, dict):
        error = {"code": "validation_error", "message": "arguments must be an object."}
        return {
            "isError": True,
            "content": [{"type": "text", "text": json.dumps({"error": error})}],
            "structuredContent": {"error": error},
        }
    errors = _validate_schema(arguments, tool.input_schema)
    if errors:
        error = {"code": "validation_error", "message": "; ".join(errors)}
        return {
            "isError": True,
            "content": [{"type": "text", "text": json.dumps({"error": error})}],
            "structuredContent": {"error": error},
        }
    inputs = dict(arguments)
    limit = inputs.pop("limit", 25)
    cursor = inputs.pop("cursor", None)
    try:
        data = jsonable_encoder(
            executor.execute(tool, inputs, user_id=user_id, connection_id=connection_id)
        )
        page = {"next_cursor": None, "has_more": False}
        if tool.paginated:
            offset = _cursor_decode(cursor, tool.name, user_id, signing_key)
            if isinstance(data, list):
                total = len(data)
                data = data[offset : offset + limit]
            elif isinstance(data, dict):
                collection_keys = {
                    "get_league_fixtures": ("fixtures",),
                    "search_players": ("players",),
                    "search_rules": ("sections",),
                    "list_trade_proposals": ("trades",),
                    "list_my_loans": ("loans",),
                    "list_pending_approvals": ("trades", "loans"),
                }.get(tool.name, ())
                lengths = [
                    len(data[key]) for key in collection_keys if isinstance(data.get(key), list)
                ]
                total = max(lengths, default=0)
                data = {
                    **data,
                    **{
                        key: value[offset : offset + limit]
                        for key in collection_keys
                        if isinstance((value := data.get(key)), list)
                    },
                }
            else:
                total = 0
            next_offset = offset + limit
            has_more = next_offset < total
            page = {
                "next_cursor": _cursor_encode(next_offset, tool.name, user_id, signing_key)
                if has_more
                else None,
                "has_more": has_more,
            }
        result = {"data": data, "page": page}
        return {
            "content": [{"type": "text", "text": json.dumps(result, default=str)}],
            "structuredContent": result,
            "isError": False,
        }
    except Exception as exc:
        code = (
            "permission_denied"
            if isinstance(exc, PermissionError)
            else "validation_error"
            if isinstance(exc, ValueError)
            else "not_found"
            if isinstance(exc, LookupError)
            else "tool_unavailable"
            if isinstance(exc, NotImplementedError)
            else "service_error"
        )
        message = (
            str(exc)
            if code != "service_error"
            else "The CDL service could not complete this action."
        )
        error = {"code": code, "message": message}
        return {
            "isError": True,
            "content": [{"type": "text", "text": json.dumps({"error": error})}],
            "structuredContent": {"error": error},
        }


@router.get("/.well-known/oauth-protected-resource")
@router.get("/.well-known/oauth-protected-resource/{resource_path:path}")
def protected_resource_metadata(
    resource_path: str = "",
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    del resource_path
    if not settings.mcp_remote_enabled:
        raise HTTPException(status_code=404, detail="Remote MCP is disabled.")
    issuer = settings.oauth_issuer_url.rstrip("/")
    return {
        "resource": f"{issuer}/mcp",
        "authorization_servers": [issuer],
        "scopes_supported": ["cdl:read", "cdl:write"],
        "bearer_methods_supported": ["header"],
    }


@router.api_route("/mcp", methods=["GET", "DELETE"])
def mcp_unsupported_method(settings: Settings = Depends(get_settings)) -> Response:
    if not settings.mcp_remote_enabled:
        raise HTTPException(status_code=404, detail="Remote MCP is disabled.")
    return Response(status_code=405, headers={"Allow": "POST"})


@router.post("/mcp")
async def mcp_post(
    request: Request,
    settings: Settings = Depends(get_settings),
    service: OAuthService = Depends(get_oauth_service),
    executor: ToolExecutor = Depends(get_tool_executor),
) -> Response:
    if not settings.mcp_remote_enabled:
        raise HTTPException(status_code=404, detail="Remote MCP is disabled.")
    _headers(request.headers.get("accept", ""), request.headers.get("content-type", ""))
    origin = request.headers.get("origin")
    if origin:
        parsed_origin = urlsplit(origin)
        request_origin = (request.url.scheme, request.url.netloc)
        if (
            parsed_origin.scheme not in {"http", "https"}
            or not parsed_origin.netloc
            or parsed_origin.path not in {"", "/"}
            or parsed_origin.query
            or parsed_origin.fragment
            or (parsed_origin.scheme, parsed_origin.netloc) != request_origin
        ):
            raise HTTPException(status_code=403, detail="Invalid Origin header.")
    try:
        claims = service.validate_access_token(_bearer_token(request))
    except OAuthError as exc:
        raise HTTPException(
            status_code=401,
            detail=exc.description,
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        ) from exc
    try:
        payload = await request.json()
    except ValueError:
        return JSONResponse(_rpc_error(None, -32700, "Parse error."), status_code=400)
    if not isinstance(payload, dict) or payload.get("jsonrpc") != "2.0":
        return JSONResponse(_rpc_error(None, -32600, "Invalid JSON-RPC request."), status_code=400)
    method = payload.get("method")
    request_id = payload.get("id")
    params = payload.get("params") or {}
    if not isinstance(params, dict):
        return JSONResponse(_rpc_error(request_id, -32602, "Request parameters must be an object."))
    if method == "initialize":
        if request_id is None:
            return JSONResponse(
                _rpc_error(None, -32600, "initialize requires a request id."), status_code=400
            )
        requested = params.get("protocolVersion", PROTOCOL_VERSION)
        if requested not in {"2025-03-26", "2025-06-18", PROTOCOL_VERSION}:
            return JSONResponse(_rpc_error(request_id, -32602, "Unsupported protocol version."))
        session_id = _session_store(settings).create(str(claims["connection_id"]), requested)
        result = {
            "protocolVersion": requested,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": "Castle Draft League", "version": "1.0.0"},
            "instructions": "Use CDL task tools only for the authenticated account.",
        }
        return JSONResponse(
            _jsonrpc(request_id, result),
            headers={"MCP-Protocol-Version": requested, "MCP-Session-Id": session_id},
        )
    protocol_version = request.headers.get("mcp-protocol-version", "2025-03-26")
    if protocol_version not in {"2025-03-26", "2025-06-18", PROTOCOL_VERSION}:
        return JSONResponse(
            _rpc_error(request_id, -32600, "Unsupported protocol version."), status_code=400
        )
    session_id = request.headers.get("mcp-session-id", "")
    session = _session_store(settings).get(session_id) if session_id else None
    if (
        not session
        or session["connection_id"] != str(claims["connection_id"])
        or session["protocol_version"] != protocol_version
    ):
        return JSONResponse(
            _rpc_error(request_id, -32600, "MCP session is missing or invalid."), status_code=400
        )
    if method == "notifications/initialized":
        _session_store(settings).initialize(session_id)
        return Response(status_code=202)
    if not session["initialized_at"]:
        return JSONResponse(
            _rpc_error(request_id, -32600, "MCP initialization is incomplete."), status_code=400
        )
    if request_id is None:
        return Response(status_code=202)
    if method == "ping":
        return JSONResponse(_jsonrpc(request_id, {}))
    if method == "tools/list":
        scopes = set(str(claims.get("scope", "")).split())
        return JSONResponse(
            _jsonrpc(
                request_id, {"tools": [_tool_payload(tool) for tool in _visible_tools(scopes)]}
            )
        )
    if method == "tools/call":
        params = params if isinstance(params, dict) else {}
        tool = _TOOLS.get(str(params.get("name", "")))
        if not tool:
            return JSONResponse(_rpc_error(request_id, -32602, "Unknown tool."))
        scopes = set(str(claims.get("scope", "")).split())
        if not {scope.value for scope in tool.scopes}.issubset(scopes):
            return JSONResponse(_rpc_error(request_id, -32602, "Insufficient OAuth scope."))
        result = _call_tool(
            tool,
            params.get("arguments", {}),
            user_id=str(claims["sub"]),
            connection_id=str(claims["connection_id"]),
            executor=executor,
            signing_key=settings.oauth_signing_secret,
        )
        return JSONResponse(_jsonrpc(request_id, result))
    return JSONResponse(_rpc_error(request_id, -32601, "Method not found."))


@router.get("/webmcp/tools")
def browser_tool_catalogue(
    settings: Settings = Depends(get_settings),
    user: SessionUser = Depends(require_authenticated_session),
) -> dict[str, Any]:
    del user
    if not settings.mcp_browser_enabled:
        raise HTTPException(status_code=404, detail="Browser WebMCP is disabled.")
    return {"tools": [_tool_payload(tool) for tool in sorted(TOOL_REGISTRY, key=lambda t: t.name)]}


@router.post("/webmcp/tools/{tool_name}")
async def browser_tool_call(
    tool_name: str,
    request: Request,
    settings: Settings = Depends(get_settings),
    user: SessionUser = Depends(require_authenticated_session),
    executor: ToolExecutor = Depends(get_tool_executor),
) -> JSONResponse:
    if not settings.mcp_browser_enabled:
        raise HTTPException(status_code=404, detail="Browser WebMCP is disabled.")
    tool = _TOOLS.get(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail="Unknown WebMCP tool.")
    try:
        arguments = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="A JSON arguments object is required.") from exc
    result = _call_tool(
        tool,
        arguments,
        user_id=user.id,
        connection_id=None,
        executor=executor,
        signing_key=settings.oauth_signing_secret or "disabled-webmcp-cursor-key",
    )
    return JSONResponse(result, status_code=200 if not result.get("isError") else 422)
