"""Wire-contract tests for remote MCP and browser WebMCP adapters."""

import base64
import hashlib

from fastapi import FastAPI
from fastapi.testclient import TestClient

from cdl_api.ai_tools.registry import ToolDefinition
from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.oauth import InMemoryOAuthRepository
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.mcp import get_tool_executor, router
from cdl_api.routers.oauth import get_oauth_service
from cdl_api.services.oauth import OAuthService
from cdl_api.settings import Settings, get_settings


class FakeToolExecutor:
    def execute(
        self,
        tool: ToolDefinition,
        arguments: dict[str, object],
        *,
        user_id: str,
        connection_id: str | None,
    ) -> object:
        return {
            "tool": tool.name,
            "arguments": arguments,
            "user_id": user_id,
            "connection_id": connection_id,
        }


def test_remote_mcp_initializes_lists_scoped_tools_and_calls_shared_executor() -> None:
    repository = InMemoryOAuthRepository()
    oauth = OAuthService(repository, "https://cdl.example", "s" * 40)
    client = oauth.register_client("MCP test", ["https://assistant.example/callback"])
    verifier = "v" * 43
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
    challenge = challenge.rstrip(b"=").decode()
    code = oauth.issue_code(
        user_id="user-7",
        client_id=str(client["client_id"]),
        redirect_uri="https://assistant.example/callback",
        scopes=["cdl:read"],
        code_challenge=challenge,
    )
    token = oauth.exchange_code(
        client_id=str(client["client_id"]),
        code=code,
        redirect_uri="https://assistant.example/callback",
        code_verifier=verifier,
    )["access_token"]
    settings = Settings(
        mcp_oauth_enabled=True,
        mcp_remote_enabled=True,
        oauth_issuer_url="https://cdl.example",
        oauth_signing_secret="s" * 40,
    )
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_oauth_service] = lambda: oauth
    app.dependency_overrides[get_tool_executor] = FakeToolExecutor
    client_http = TestClient(app)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
    }

    before_initialize = client_http.post(
        "/mcp",
        headers={**headers, "MCP-Protocol-Version": "2025-11-25"},
        json={"jsonrpc": "2.0", "id": 0, "method": "tools/list"},
    )
    assert before_initialize.status_code == 400

    initialize = client_http.post(
        "/mcp",
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {"protocolVersion": "2025-11-25", "capabilities": {}},
        },
    )
    assert initialize.status_code == 200
    assert initialize.json()["result"]["protocolVersion"] == "2025-11-25"
    assert initialize.headers["mcp-protocol-version"] == "2025-11-25"
    session_id = initialize.headers["mcp-session-id"]
    headers["MCP-Session-Id"] = session_id
    headers["MCP-Protocol-Version"] = "2025-11-25"
    initialized = client_http.post(
        "/mcp",
        headers=headers,
        json={"jsonrpc": "2.0", "method": "notifications/initialized"},
    )
    assert initialized.status_code == 202

    listed = client_http.post(
        "/mcp",
        headers=headers,
        json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
    )
    tools = listed.json()["result"]["tools"]
    assert tools == sorted(tools, key=lambda tool: tool["name"])
    assert "get_my_preferences" in {tool["name"] for tool in tools}
    assert "update_my_preferences" not in {tool["name"] for tool in tools}
    assert tools[0]["inputSchema"]["additionalProperties"] is False

    invalid_version = client_http.post(
        "/mcp",
        headers={**headers, "MCP-Protocol-Version": "unsupported"},
        json={"jsonrpc": "2.0", "id": 3, "method": "tools/list"},
    )
    assert invalid_version.status_code == 400
    called = client_http.post(
        "/mcp",
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "get_my_preferences", "arguments": {}},
        },
    )
    result = called.json()["result"]
    assert result["isError"] is False
    assert result["structuredContent"]["data"]["user_id"] == "user-7"
    assert result["structuredContent"]["data"]["connection_id"]


def test_remote_mcp_requires_a_valid_bearer_and_reports_structured_validation_errors() -> None:
    settings = Settings(
        mcp_oauth_enabled=True,
        mcp_remote_enabled=True,
        oauth_issuer_url="https://cdl.example",
        oauth_signing_secret="s" * 40,
    )
    oauth = OAuthService(InMemoryOAuthRepository(), "https://cdl.example", "s" * 40)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_oauth_service] = lambda: oauth
    app.dependency_overrides[get_tool_executor] = FakeToolExecutor
    client = TestClient(app)
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    request = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}

    denied = client.post("/mcp", headers=headers, json=request)
    assert denied.status_code == 401
    assert "resource_metadata" in denied.headers["www-authenticate"]
    unsupported = client.get("/mcp")
    assert unsupported.status_code == 405


def test_mcp_rejects_bad_origin_and_accept_and_advertises_actual_resource() -> None:
    settings = Settings(
        mcp_oauth_enabled=True,
        mcp_remote_enabled=True,
        oauth_issuer_url="https://cdl.example",
        oauth_signing_secret="s" * 40,
    )
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_settings] = lambda: settings
    client = TestClient(app)
    metadata = client.get("/.well-known/oauth-protected-resource")
    assert metadata.json()["resource"] == "https://cdl.example/mcp"
    bad_accept = client.post(
        "/mcp",
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize"},
    )
    assert bad_accept.status_code == 406
    bad_origin = client.post(
        "/mcp",
        headers={
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "Origin": "https://attacker.example",
        },
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize"},
    )
    assert bad_origin.status_code == 403


def test_browser_webmcp_uses_session_identity_and_shared_registry_executor() -> None:
    settings = Settings(mcp_browser_enabled=True)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[require_authenticated_session] = lambda: SessionUser(
        id="browser-user", email="manager@example.com", display_name="Manager"
    )
    app.dependency_overrides[get_tool_executor] = FakeToolExecutor
    client = TestClient(app)

    catalogue = client.get("/webmcp/tools")
    assert catalogue.status_code == 200
    assert "get_my_preferences" in {tool["name"] for tool in catalogue.json()["tools"]}
    result = client.post("/webmcp/tools/get_my_preferences", json={})
    assert result.status_code == 200
    assert result.json()["structuredContent"]["data"]["user_id"] == "browser-user"


def test_paginated_results_use_user_and_tool_bound_opaque_cursors() -> None:
    from cdl_api.ai_tools.registry import TOOL_REGISTRY
    from cdl_api.routers.mcp import _call_tool

    tool = next(item for item in TOOL_REGISTRY if item.name == "get_league_fixtures")

    class RowsExecutor:
        def execute(
            self,
            tool: ToolDefinition,
            arguments: dict[str, object],
            *,
            user_id: str,
            connection_id: str | None,
        ) -> object:
            del tool, arguments, user_id, connection_id
            return list(range(60))

    first = _call_tool(
        tool,
        {"limit": 50},
        user_id="user-a",
        connection_id="connection-a",
        executor=RowsExecutor(),
        signing_key="cursor signing secret",
    )["structuredContent"]
    assert len(first["data"]) == 50
    assert first["page"]["has_more"] is True
    second = _call_tool(
        tool,
        {"limit": 50, "cursor": first["page"]["next_cursor"]},
        user_id="user-a",
        connection_id="connection-a",
        executor=RowsExecutor(),
        signing_key="cursor signing secret",
    )["structuredContent"]
    assert second["data"] == list(range(50, 60))
    invalid = _call_tool(
        tool,
        {"limit": 50, "cursor": first["page"]["next_cursor"]},
        user_id="user-b",
        connection_id="connection-b",
        executor=RowsExecutor(),
        signing_key="cursor signing secret",
    )
    assert invalid["isError"] is True
