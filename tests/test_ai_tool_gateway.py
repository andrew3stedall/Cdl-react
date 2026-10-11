from types import SimpleNamespace
from typing import Self

import pytest

from cdl_api.ai_tools.registry import get_tool
from cdl_api.repositories.ai_execution import InMemoryAIExecutionRepository
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.services.ai_execution import AIExecutionPolicy
from cdl_api.services.ai_tool_gateway import AIExecutionGateway, ExistingServiceDispatcher
from cdl_api.settings import Settings


def test_trade_response_dispatch_uses_authenticated_user_as_actor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    class Squad:
        def update_trade(self, trade_id: str, status: str, actor_manager_id: str) -> str:
            captured.update(
                trade_id=trade_id,
                status=status,
                actor_manager_id=actor_manager_id,
            )
            return "updated"

    monkeypatch.setattr(
        "cdl_api.services.ai_tool_gateway.build_repositories",
        lambda settings: SimpleNamespace(),
    )
    dispatcher = ExistingServiceDispatcher(Settings(repository_mode="postgres"))
    monkeypatch.setattr(dispatcher, "_require_actor_scoped_storage", lambda: None)
    monkeypatch.setattr(dispatcher, "_squad_service", lambda user_id: Squad())

    result = dispatcher.execute(
        get_tool("respond_to_trade"),
        {"trade_id": "trade-1", "status": "accepted", "idempotency_key": "key-1"},
        user_id="user-1",
    )

    assert result == "updated"
    assert captured == {
        "trade_id": "trade-1",
        "status": "accepted",
        "actor_manager_id": "user-1",
    }


def test_interest_delete_query_is_scoped_to_owner_and_active_interest() -> None:
    class Result:
        rowcount = 0

    class Session:
        statement = None

        def __enter__(self) -> Self:
            return self

        def __exit__(self, *args: object) -> None:
            del args
            return None

        def execute(self, statement: object) -> Result:
            self.statement = statement
            return Result()

        def commit(self) -> None:
            pass

    session = Session()
    repository = object.__new__(PostgreSQLSquadRepository)
    repository._session_factory = lambda: session
    repository._manager_id = "manager-1"

    assert repository.delete_interest("interest-1") is False
    sql = str(session.statement.compile(compile_kwargs={"literal_binds": True}))
    assert "manager_id = 'manager-1'" in sql
    assert "status = 'active'" in sql


def test_denied_role_attempt_is_recorded_without_sensitive_arguments(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Memberships:
        def access_for_user(self, _user_id: str) -> None:
            return None

    monkeypatch.setattr(
        "cdl_api.services.ai_tool_gateway.build_repositories",
        lambda _settings: SimpleNamespace(league_memberships=Memberships()),
    )
    policy = AIExecutionPolicy(InMemoryAIExecutionRepository())
    gateway = AIExecutionGateway(Settings(repository_mode="memory"), policy)
    tool = get_tool("manage_league_invite")
    assert tool is not None

    with pytest.raises(PermissionError):
        gateway.execute(
            tool,
            {"action": "create", "team_id": "team-1", "note": "private"},
            user_id="user-1",
            connection_id="assistant-1",
        )

    events = policy.activity("user-1")
    assert len(events) == 1
    assert events[0]["connection_id"] == "assistant-1"
    assert events[0]["outcome"] == "permission_denied"
    assert events[0]["details"]["note"] == "[redacted]"
