"""Read-only registry dispatch uses the existing CDL service boundaries."""

from types import SimpleNamespace

import pytest

from cdl_api.ai_tools.registry import get_tool
from cdl_api.services.ai_tool_gateway import ExistingServiceDispatcher
from cdl_api.settings import Settings


def test_read_tools_dispatch_through_existing_services() -> None:
    dispatcher = ExistingServiceDispatcher(Settings(repository_mode="memory"))

    expected_types = {
        "get_my_squad": "SquadWorkspaceResponse",
        "get_my_team_selection": "TeamSelectionResponse",
        "get_manager_desk": "ManagerDeskResponse",
        "get_league_table": "LeagueTableResponse",
        "get_league_fixtures": "LeagueFixturesResponse",
        "search_players": "ScoutingPlayersResponse",
        "search_rules": "RulesIndexResponse",
        "get_fixture_difficulty": "FixtureDifficultyCombinedResponse",
        "get_dashboard_metrics": "list",
        "get_team_selection_fixture_summary": "FixtureSummaryPanel",
    }
    arguments = {
        "get_league_table": {"mode": "official"},
        "get_league_fixtures": {"period": "all"},
        "search_players": {"query": "", "metric": "total_points"},
        "search_rules": {"query": "trade"},
    }

    for name, expected_type in expected_types.items():
        tool = get_tool(name)
        assert tool is not None
        result = dispatcher.execute(tool, arguments.get(name, {}), user_id="user-1")
        assert type(result).__name__ == expected_type


def test_read_state_version_is_stable_for_same_selection() -> None:
    dispatcher = ExistingServiceDispatcher(Settings(repository_mode="memory"))
    tool = get_tool("save_my_lineup")
    assert tool is not None

    first = dispatcher.state_version(tool, {}, user_id="user-1")
    second = dispatcher.state_version(tool, {}, user_id="user-1")

    assert len(first) == 64
    assert first == second


def test_league_fixture_adapter_returns_the_registered_response_model() -> None:
    dispatcher = ExistingServiceDispatcher(Settings(repository_mode="memory"))
    tool = get_tool("get_league_fixtures")
    assert tool is not None

    result = dispatcher.execute(tool, {"period": "all"}, user_id="user-1")

    assert type(result).__name__ == "LeagueFixturesResponse"


def test_palette_write_uses_existing_owner_scoped_service() -> None:
    dispatcher = ExistingServiceDispatcher(Settings(repository_mode="memory"))
    tool = get_tool("manage_colour_palette")
    assert tool is not None
    arguments = {
        "action": "create",
        "palette_type": "fdr",
        "name": "AI palette",
        "mode": "anchors",
        "min": "#112233",
        "second": "#223344",
        "mid": "#334455",
        "fourth": "#445566",
        "max": "#556677",
    }

    created = dispatcher.execute(tool, arguments, user_id="user-1")

    assert created.name == "AI palette"
    assert created.id.startswith("fdr-")
    assert (
        dispatcher.execute(
            tool,
            {"action": "delete", "palette_type": "fdr", "palette_id": created.id},
            user_id="user-1",
        )
        is None
    )


def test_live_draft_queue_uses_membership_team_and_no_execution_grant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    class LiveDraft:
        def __init__(self, _factory: object) -> None:
            pass

        def membership(self, user_id: str) -> dict[str, str]:
            assert user_id == "user-1"
            return {"team_id": "team-1", "role": "manager"}

        def set_queue(self, actor_id: str, team_id: str, player_ids: list[str]) -> None:
            captured.update(actor_id=actor_id, team_id=team_id, player_ids=player_ids)

    monkeypatch.setattr(
        "cdl_api.services.ai_tool_gateway.build_repositories",
        lambda _settings: SimpleNamespace(),
    )
    monkeypatch.setattr("cdl_api.database.build_session_factory", lambda _settings: object())
    monkeypatch.setattr("cdl_api.services.live_draft.LiveDraftService", LiveDraft)
    dispatcher = ExistingServiceDispatcher(Settings(repository_mode="postgres"))
    monkeypatch.setattr(dispatcher, "_require_actor_scoped_storage", lambda: None)
    tool = get_tool("update_live_draft_queue")
    assert tool is not None

    result = dispatcher.execute(tool, {"player_ids": ["player-1"]}, user_id="user-1")

    assert result == {"player_ids": ["player-1"]}
    assert captured == {
        "actor_id": "user-1",
        "team_id": "team-1",
        "player_ids": ["player-1"],
    }
    assert tool.risk.value == "personal_reversible"
