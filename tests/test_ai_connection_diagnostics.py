"""AI connection verification state, manual checks, isolation and repair diagnostics."""

import base64
import hashlib
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from cdl_api.ai_tools.registry import get_tool
from cdl_api.contracts.ai_connections import AIConnectionState, AIMCPEndpointStatus
from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.ai_execution import InMemoryAIExecutionRepository
from cdl_api.repositories.oauth import InMemoryOAuthRepository
from cdl_api.routers.ai_connections import get_ai_connection_diagnostics, router
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.services.ai_connection_diagnostics import (
    CHECK_RISK,
    CHECK_TOOL_NAME,
    AIConnectionDiagnosticsService,
)
from cdl_api.services.ai_execution import AIExecutionPolicy
from cdl_api.services.ai_tool_gateway import AIExecutionGateway
from cdl_api.services.oauth import OAuthError, OAuthService
from cdl_api.settings import Settings, get_settings

ISSUER = "https://cdl.example"
SECRET = "s" * 40
VERIFIER = "v" * 43
CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).rstrip(b"=")


class _ReadDispatcher:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail

    def state_version(self, *args: object, **kwargs: object) -> str:
        return "v1"

    def execute(self, *args: object, **kwargs: object) -> dict[str, str]:
        if self.fail:
            raise RuntimeError("upstream unavailable")
        return {"team": "summary"}


def _connect(
    service: OAuthService, user_id: str, name: str, scopes: list[str]
) -> dict[str, object]:
    client = service.register_client(name, ["https://assistant.example/callback"])
    code = service.issue_code(
        user_id=user_id,
        client_id=str(client["client_id"]),
        redirect_uri="https://assistant.example/callback",
        scopes=scopes,
        code_challenge=CHALLENGE.decode(),
    )
    tokens = service.exchange_code(
        client_id=str(client["client_id"]),
        code=code,
        redirect_uri="https://assistant.example/callback",
        code_verifier=VERIFIER,
    )
    claims = service.validate_access_token(str(tokens["access_token"]))
    return {"client_id": client["client_id"], "connection_id": claims["connection_id"], **tokens}


def _build(
    team_assigned: bool | None = True,
) -> tuple[
    OAuthService,
    InMemoryOAuthRepository,
    InMemoryAIExecutionRepository,
    AIExecutionPolicy,
    AIConnectionDiagnosticsService,
]:
    oauth_repository = InMemoryOAuthRepository()
    oauth = OAuthService(oauth_repository, ISSUER, SECRET)
    execution = InMemoryAIExecutionRepository()
    policy = AIExecutionPolicy(execution)
    diagnostics = AIConnectionDiagnosticsService(
        connections=oauth_repository,
        evidence=execution,
        policy=policy,
        endpoint=AIMCPEndpointStatus(
            url=f"{ISSUER}/mcp",
            oauth_enabled=True,
            remote_enabled=True,
            browser_enabled=True,
            execution_enabled=True,
        ),
        team_lookup=lambda user_id: team_assigned,
    )
    return oauth, oauth_repository, execution, policy, diagnostics


def _gateway(policy: AIExecutionPolicy, *, fail: bool = False) -> AIExecutionGateway:
    gateway = AIExecutionGateway(Settings(), policy, dispatcher=_ReadDispatcher(fail=fail))
    gateway._authorize_role = lambda tool, user_id: None  # type: ignore[method-assign]
    return gateway


def _state(diagnostics: AIConnectionDiagnosticsService, user_id: str, connection_id: object) -> str:
    rows = diagnostics.diagnostics(user_id).connections
    return next(row.state.value for row in rows if row.id == connection_id)


def test_consent_alone_is_authorized_not_verified() -> None:
    oauth, _, _, _, diagnostics = _build()
    connection = _connect(oauth, "user-1", "ChatGPT", ["cdl:read"])

    result = diagnostics.diagnostics("user-1")

    assert result.endpoint.url == "https://cdl.example/mcp"
    assert result.team_assigned is True
    [row] = result.connections
    assert row.id == connection["connection_id"]
    assert row.state is AIConnectionState.AUTHORIZED
    assert row.last_verified_read_at is None
    assert row.access_expires_at is not None


def test_only_a_correlated_remote_read_marks_the_connection_verified() -> None:
    oauth, _, _, policy, diagnostics = _build()
    first = _connect(oauth, "user-1", "ChatGPT", ["cdl:read"])
    second = _connect(oauth, "user-1", "Claude", ["cdl:read"])
    gateway = _gateway(policy)

    # Browser WebMCP and consequential/personal tools never verify a remote provider.
    gateway.execute(get_tool("get_manager_desk"), {}, user_id="user-1", connection_id=None)
    policy.record_activity(
        user_id="user-1",
        connection_id=str(second["connection_id"]),
        tool_name="manage_player_interest",
        risk="personal_reversible",
        outcome="success",
        arguments={},
    )
    gateway.execute(
        get_tool("get_manager_desk"),
        {},
        user_id="user-1",
        connection_id=str(first["connection_id"]),
    )

    assert _state(diagnostics, "user-1", first["connection_id"]) == "verified"
    assert _state(diagnostics, "user-1", second["connection_id"]) == "authorized"
    verified = next(
        row
        for row in diagnostics.diagnostics("user-1").connections
        if row.id == first["connection_id"]
    )
    assert verified.first_verified_read_at == verified.last_verified_read_at


def test_failed_read_after_success_reports_sanitized_category_until_next_success() -> None:
    oauth, _, _, policy, diagnostics = _build()
    connection = _connect(oauth, "user-1", "ChatGPT", ["cdl:read"])
    connection_id = str(connection["connection_id"])
    _gateway(policy).execute(
        get_tool("get_manager_desk"), {}, user_id="user-1", connection_id=connection_id
    )
    with pytest.raises(RuntimeError):
        _gateway(policy, fail=True).execute(
            get_tool("get_manager_desk"), {}, user_id="user-1", connection_id=connection_id
        )

    [row] = diagnostics.diagnostics("user-1").connections
    assert row.state is AIConnectionState.CHECK_FAILED
    assert row.last_failure is not None
    assert row.last_failure.category.value == "service"
    assert "upstream" not in row.model_dump_json()
    assert row.last_verified_read_at is not None

    _gateway(policy).execute(
        get_tool("get_manager_desk"), {}, user_id="user-1", connection_id=connection_id
    )
    assert _state(diagnostics, "user-1", connection_id) == "verified"


def test_revoked_and_replay_revoked_connections_remain_visible_for_reconnect() -> None:
    oauth, _, _, _, diagnostics = _build()
    revoked = _connect(oauth, "user-1", "ChatGPT", ["cdl:read"])
    replayed = _connect(oauth, "user-1", "Claude", ["cdl:read"])
    oauth.revoke_connection(str(revoked["connection_id"]), "user-1")
    old_refresh = str(replayed["refresh_token"])
    oauth.refresh(client_id=str(replayed["client_id"]), refresh_token=old_refresh)
    with pytest.raises(OAuthError):
        oauth.refresh(client_id=str(replayed["client_id"]), refresh_token=old_refresh)

    states = {row.id: row for row in diagnostics.diagnostics("user-1").connections}
    assert states[str(revoked["connection_id"])].state is AIConnectionState.REVOKED
    assert states[str(replayed["connection_id"])].state is AIConnectionState.REVOKED
    assert states[str(revoked["connection_id"])].revoked_at is not None
    assert oauth.list_connections("user-1") == []


def test_expired_refresh_and_old_revocations_are_reported_correctly() -> None:
    oauth, repository, _, _, diagnostics = _build()
    expired = _connect(oauth, "user-1", "ChatGPT", ["cdl:read"])
    old = _connect(oauth, "user-1", "Claude", ["cdl:read"])
    for entry in repository._refresh.values():
        if entry["connection_id"] == expired["connection_id"]:
            entry["expires_at"] = datetime.now(UTC) - timedelta(minutes=1)
    stale_revocation = datetime.now(UTC) - timedelta(days=30)
    repository._connections[str(old["connection_id"])]["revoked_at"] = stale_revocation

    rows = diagnostics.diagnostics("user-1").connections
    assert [row.id for row in rows] == [expired["connection_id"]]
    assert rows[0].state is AIConnectionState.EXPIRED


def test_manual_check_is_owner_scoped_and_audited_without_counting_as_verification() -> None:
    oauth, _, execution, policy, diagnostics = _build()
    mine = _connect(oauth, "user-1", "ChatGPT", ["cdl:read"])
    theirs = _connect(oauth, "user-2", "ChatGPT", ["cdl:read", "cdl:write"])

    result = diagnostics.check("user-1", str(mine["connection_id"]))
    assert result.state is AIConnectionState.AUTHORIZED
    [event] = policy.activity("user-1")
    assert event["tool_name"] == CHECK_TOOL_NAME
    assert event["risk"] == CHECK_RISK
    assert event["outcome"] == "authorized"
    assert _state(diagnostics, "user-1", mine["connection_id"]) == "authorized"

    with pytest.raises(LookupError):
        diagnostics.check("user-1", str(theirs["connection_id"]))
    assert [row.id for row in diagnostics.diagnostics("user-2").connections] == [
        theirs["connection_id"]
    ]
    assert len(execution.events) == 1


def test_team_lookup_failure_degrades_to_unknown() -> None:
    _, _, _, _, diagnostics = _build()

    def broken(user_id: str) -> bool:
        raise RuntimeError("membership store unavailable")

    diagnostics._team_lookup = broken
    assert diagnostics.diagnostics("user-1").team_assigned is None


def test_http_routes_are_no_store_owner_scoped_and_flag_gated() -> None:
    oauth, _, _, _, diagnostics = _build()
    mine = _connect(oauth, "user-1", "ChatGPT", ["cdl:read"])
    theirs = _connect(oauth, "user-2", "Claude", ["cdl:read"])
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_ai_connection_diagnostics] = lambda: diagnostics
    app.dependency_overrides[require_authenticated_session] = lambda: SessionUser(
        id="user-1", email="manager@example.com", display_name="Manager"
    )
    client = TestClient(app)

    listing = client.get("/api/ai/connections")
    assert listing.status_code == 200
    assert listing.headers["cache-control"] == "no-store"
    body = listing.json()
    assert [row["id"] for row in body["connections"]] == [mine["connection_id"]]
    assert body["connections"][0]["state"] == "authorized"
    assert body["endpoint"]["url"] == "https://cdl.example/mcp"

    check = client.post(f"/api/ai/connections/{mine['connection_id']}/check")
    assert check.status_code == 200
    assert check.headers["cache-control"] == "no-store"
    assert client.post(f"/api/ai/connections/{theirs['connection_id']}/check").status_code == 404

    disabled = FastAPI()
    disabled.include_router(router, prefix="/api")
    disabled.dependency_overrides[require_authenticated_session] = lambda: SessionUser(
        id="user-1", email="manager@example.com", display_name="Manager"
    )
    disabled.dependency_overrides[get_settings] = lambda: Settings(mcp_oauth_enabled=False)
    assert TestClient(disabled).get("/api/ai/connections").status_code == 404


def test_execution_grant_activation_accepts_owned_oauth_connections() -> None:
    """Regression: OAuth connection rows are mappings, so ownership must read row["id"]."""
    from cdl_api.routers.ai_execution import get_ai_execution_policy
    from cdl_api.routers.ai_execution import router as execution_router
    from cdl_api.routers.oauth import get_oauth_service

    oauth, _, _, policy, _ = _build()
    mine = _connect(oauth, "user-1", "ChatGPT", ["cdl:read", "cdl:write"])
    theirs = _connect(oauth, "user-2", "Claude", ["cdl:read", "cdl:write"])
    app = FastAPI()
    app.include_router(execution_router, prefix="/api")
    app.dependency_overrides[get_settings] = lambda: Settings(
        mcp_execution_enabled=True,
        mcp_browser_enabled=True,
    )
    app.dependency_overrides[get_oauth_service] = lambda: oauth
    app.dependency_overrides[get_ai_execution_policy] = lambda: policy
    app.dependency_overrides[require_authenticated_session] = lambda: SessionUser(
        id="user-1", email="manager@example.com", display_name="Manager"
    )
    client = TestClient(app)

    activated = client.post(
        "/api/ai/execution-grants", json={"connection_id": mine["connection_id"]}
    )
    assert activated.status_code == 200
    assert activated.json()["connection_id"] == mine["connection_id"]
    assert (
        client.post(
            "/api/ai/execution-grants", json={"connection_id": theirs["connection_id"]}
        ).status_code
        == 404
    )
