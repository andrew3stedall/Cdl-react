"""Exact-action execution policy and routine audit retention tests."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest

import cdl_api.services.ai_tool_gateway as gateway_module
from cdl_api.ai_tools.registry import ToolDefinition, get_tool
from cdl_api.repositories.ai_execution import InMemoryAIExecutionRepository
from cdl_api.services.ai_execution import AIExecutionPolicy
from cdl_api.services.ai_tool_gateway import AIExecutionGateway


def test_consequential_action_requires_grant_and_exact_one_time_approval() -> None:
    repository = InMemoryAIExecutionRepository()
    policy = AIExecutionPolicy(repository)
    action = {"team_id": "team-1", "idempotency_key": "req-1"}

    blocked = policy.prepare_consequential(
        user_id="user-1",
        connection_id="connection-1",
        tool_name="make_live_draft_pick",
        arguments=action,
        idempotency_key="req-1",
        state_version="draft:4",
        approval_base_url="https://cdl.example/api",
    )
    assert blocked["status"] == "execution_grant_required"

    grant = policy.activate("user-1", "connection-1")
    assert (grant["expires_at"] - grant["activated_at"]) == timedelta(hours=1)
    pending = policy.prepare_consequential(
        user_id="user-1",
        connection_id="connection-1",
        tool_name="make_live_draft_pick",
        arguments=action,
        idempotency_key="req-1",
        state_version="draft:4",
        approval_base_url="https://cdl.example/api",
    )
    assert pending["status"] == "approval_required"
    assert pending["approval_url"].endswith(f"/ai-approvals/{pending['proposal_id']}")
    assert policy.get_proposal(str(pending["proposal_id"]), "other-user") is None
    assert policy.approve(str(pending["proposal_id"]), "other-user") is False
    assert policy.approve(str(pending["proposal_id"]), "user-1") is True

    changed_state = policy.prepare_consequential(
        user_id="user-1",
        connection_id="connection-1",
        tool_name="make_live_draft_pick",
        arguments=action,
        idempotency_key="req-1",
        state_version="draft:5",
        approval_base_url="https://cdl.example/api",
    )
    assert changed_state["status"] == "state_changed"


def test_exact_action_digest_blocks_parameter_replay_and_records_redacted_activity() -> None:
    repository = InMemoryAIExecutionRepository()
    policy = AIExecutionPolicy(repository)
    policy.activate("user-1", "connection-1")
    original = {"player_id": "player-1", "idempotency_key": "req-2", "note": "private"}
    pending = policy.prepare_consequential(
        user_id="user-1",
        connection_id="connection-1",
        tool_name="manage_player_interest",
        arguments=original,
        idempotency_key="req-2",
        state_version="squad:9",
        approval_base_url="https://cdl.example/api",
    )
    policy.approve(str(pending["proposal_id"]), "user-1")
    changed = policy.prepare_consequential(
        user_id="user-1",
        connection_id="connection-1",
        tool_name="manage_player_interest",
        arguments={**original, "player_id": "player-2"},
        idempotency_key="req-2",
        state_version="squad:9",
        approval_base_url="https://cdl.example/api",
    )
    assert changed["status"] == "idempotency_conflict"

    policy.record_activity(
        user_id="user-1",
        connection_id="connection-1",
        tool_name="manage_player_interest",
        risk="consequential",
        outcome="approval_required",
        arguments=original,
    )
    activity = policy.activity("user-1")
    assert activity[0]["details"]["note"] == "[redacted]"
    assert policy.activity("other-user") == []

    old = dict(repository.events[0])
    old["retention_until"] = datetime.now(UTC) - timedelta(seconds=1)
    repository.events[0] = old
    assert policy.activity("user-1") == []
    assert repository.events == []


class _Dispatcher:
    def __init__(self) -> None:
        self.current_state = "squad:1"
        self.state_checks = 0
        self.executions: list[dict[str, Any]] = []

    def state_version(
        self, tool: ToolDefinition, arguments: dict[str, Any], *, user_id: str
    ) -> str:
        del tool, arguments, user_id
        self.state_checks += 1
        return self.current_state

    def execute(
        self, tool: ToolDefinition, arguments: dict[str, Any], *, user_id: str
    ) -> dict[str, str]:
        del tool, user_id
        self.executions.append(dict(arguments))
        return {"saved": "once"}


def _gateway(
    monkeypatch: pytest.MonkeyPatch,
    *,
    policy: AIExecutionPolicy,
    dispatcher: _Dispatcher,
    role: str = "manager",
    team_id: str | None = "team-1",
) -> AIExecutionGateway:
    access = SimpleNamespace(role=role, team_id=team_id)
    repositories = SimpleNamespace(
        league_memberships=SimpleNamespace(access_for_user=lambda user_id: access),
        users=SimpleNamespace(get_by_id=lambda user_id: SimpleNamespace(email="")),
    )
    monkeypatch.setattr(gateway_module, "build_repositories", lambda settings: repositories)
    settings = SimpleNamespace(
        api_prefix="/api",
        oauth_issuer_url="https://cdl.example",
        commissioner_email_set=set(),
    )
    return AIExecutionGateway(settings, policy, dispatcher)


def test_gateway_blocks_consequential_action_without_connection_grant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    policy = AIExecutionPolicy(InMemoryAIExecutionRepository())
    policy.activate("user-1", "another-connection")
    dispatcher = _Dispatcher()
    gateway = _gateway(monkeypatch, policy=policy, dispatcher=dispatcher)
    tool = get_tool("save_my_lineup")
    assert tool is not None

    result = gateway.execute(
        tool,
        {"players": [], "idempotency_key": "lineup-1"},
        user_id="user-1",
        connection_id="connection-1",
    )

    assert result == {"status": "execution_grant_required"}
    assert dispatcher.state_checks == 0
    assert dispatcher.executions == []
    assert policy.activity("user-1")[0]["outcome"] == "blocked_grant"


def test_gateway_approval_binds_exact_action_and_completed_replay_never_executes_twice(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    policy = AIExecutionPolicy(InMemoryAIExecutionRepository())
    policy.activate("user-1", "connection-1")
    dispatcher = _Dispatcher()
    gateway = _gateway(monkeypatch, policy=policy, dispatcher=dispatcher)
    tool = get_tool("save_my_lineup")
    assert tool is not None
    arguments = {"players": [], "idempotency_key": "lineup-2"}

    pending = gateway.execute(tool, arguments, user_id="user-1", connection_id="connection-1")
    assert pending["status"] == "approval_required"
    proposal_id = str(pending["proposal_id"])
    assert policy.approve(proposal_id, "user-1") is True

    completed = gateway.execute(tool, arguments, user_id="user-1", connection_id="connection-1")
    assert completed == {"saved": "once"}
    assert dispatcher.executions == [arguments]

    replay = gateway.execute(tool, arguments, user_id="user-1", connection_id="connection-1")
    assert replay == {"status": "completed", "result": {"saved": "once"}}
    assert dispatcher.executions == [arguments]


def test_gateway_rejects_manager_tool_for_unassigned_non_manager_role(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    policy = AIExecutionPolicy(InMemoryAIExecutionRepository())
    dispatcher = _Dispatcher()
    gateway = _gateway(
        monkeypatch, policy=policy, dispatcher=dispatcher, role="member", team_id=None
    )
    tool = get_tool("save_my_lineup")
    assert tool is not None

    with pytest.raises(PermissionError, match="assigned league manager role"):
        gateway.execute(
            tool,
            {"players": [], "idempotency_key": "lineup-3"},
            user_id="user-1",
            connection_id="connection-1",
        )

    assert dispatcher.state_checks == 0
    assert dispatcher.executions == []
    events = policy.activity("user-1")
    assert len(events) == 1
    assert events[0]["outcome"] == "permission_denied"


def test_gateway_rechecks_state_after_approval_before_dispatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    policy = AIExecutionPolicy(InMemoryAIExecutionRepository())
    policy.activate("user-1", "connection-1")
    dispatcher = _Dispatcher()
    gateway = _gateway(monkeypatch, policy=policy, dispatcher=dispatcher)
    tool = get_tool("save_my_lineup")
    assert tool is not None
    arguments = {"players": [], "idempotency_key": "lineup-4"}

    pending = gateway.execute(tool, arguments, user_id="user-1", connection_id="connection-1")
    proposal_id = str(pending["proposal_id"])
    assert policy.approve(proposal_id, "user-1") is True
    dispatcher.current_state = "squad:2"

    stale = gateway.execute(tool, arguments, user_id="user-1", connection_id="connection-1")

    assert stale["status"] == "state_changed"
    assert dispatcher.executions == []
