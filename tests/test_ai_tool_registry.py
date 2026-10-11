"""Contract checks for the shared AI tool catalogue."""

from cdl_api.ai_tools.registry import (
    TOOL_REGISTRY,
    ToolRisk,
    ToolScope,
    get_tool,
    list_tools,
)
from cdl_api.contracts.loans import LoanCreateRequest
from cdl_api.contracts.scouting import ScoutingNoteUpdate
from cdl_api.contracts.squad import ScoutingFilters, TradeCreateRequest
from cdl_api.contracts.team_selection import LineupUpdateRequest
from cdl_api.contracts.theme import UserPreferences
from cdl_api.repositories.league_memberships import (
    InMemoryLeagueMembershipRepository,
    PostgreSQLLeagueMembershipRepository,
)
from cdl_api.repositories.private_scouting import PrivateScoutingRepository
from cdl_api.services.dashboard_service import DashboardService, WidgetQueryService
from cdl_api.services.fdr_custom_palettes import FdrCustomPaletteService
from cdl_api.services.fdr_service import FixtureDifficultyService
from cdl_api.services.fpl_data_service import FplDataService
from cdl_api.services.free_agency_draws import FreeAgencyDrawService
from cdl_api.services.league_service import FixtureService, LeagueTableService
from cdl_api.services.live_draft import LiveDraftService
from cdl_api.services.loans import LoanService
from cdl_api.services.manager_desk import ManagerDeskService
from cdl_api.services.player_colour_palettes import PlayerColourPaletteService
from cdl_api.services.preferences import UserPreferenceService
from cdl_api.services.rules_service import RulesService
from cdl_api.services.squad import SquadManagementService
from cdl_api.services.squad_workspace import SquadWorkspaceService
from cdl_api.services.team_selection import ChipService, FixtureSummaryService, TeamSelectionService


def test_registry_names_are_unique_and_task_oriented() -> None:
    names = [tool.name for tool in TOOL_REGISTRY]

    assert len(names) == len(set(names))
    assert all(" " not in name for name in names)
    assert all(tool.title and tool.description for tool in TOOL_REGISTRY)


def test_every_schema_is_a_closed_json_object_with_valid_required_fields() -> None:
    for tool in TOOL_REGISTRY:
        schema = tool.input_schema
        assert schema["type"] == "object"
        assert schema["additionalProperties"] is False
        assert set(schema["required"]).issubset(schema["properties"])


def test_registry_has_versioned_response_contracts_and_pagination_envelopes() -> None:
    for tool in TOOL_REGISTRY:
        assert tool.version == "1.0.0"
        assert tool.response_contract != "CdlToolResult"
        assert tool.response_schema["required"] == ["data", "page"]
        data_schema = tool.response_schema["properties"]["data"]
        assert data_schema.get("type") in {"object", "array"} or data_schema.get("oneOf")
        if tool.paginated:
            assert "page" in tool.response_schema["required"]


def test_response_schemas_publish_concrete_contract_fields() -> None:
    squad_schema = get_tool("get_my_squad").response_schema
    assert {"summary", "notifications"}.issubset(squad_schema["properties"]["data"]["properties"])
    assert "players" in squad_schema["$defs"]["SquadSummaryResponse"]["properties"]
    assert all("x-cdl-response-contract" not in str(tool.response_schema) for tool in TOOL_REGISTRY)


def test_action_tools_expose_conditional_requirements_and_route_response_shapes() -> None:
    invite = get_tool("manage_league_invite")
    assert invite.input_schema["allOf"][0] == {
        "if": {"properties": {"action": {"const": "create"}}},
        "then": {"required": ["team_id"]},
    }
    assert invite.input_schema["allOf"][1] == {
        "if": {"properties": {"action": {"const": "revoke"}}},
        "then": {"required": ["invite_id"]},
    }
    assert "revoked" in str(invite.response_schema)
    assert get_tool("submit_free_agency_preferences").response_contract == (
        "list[FreeAgencyPreference]"
    )
    assert "league_id" not in get_tool("list_trade_proposals").input_schema["properties"]


def test_each_registry_target_is_an_existing_service_or_repository() -> None:
    owners = {
        cls.__name__
        for cls in (
            DashboardService,
            WidgetQueryService,
            FdrCustomPaletteService,
            FixtureDifficultyService,
            FixtureService,
            FplDataService,
            FreeAgencyDrawService,
            InMemoryLeagueMembershipRepository,
            LeagueTableService,
            LiveDraftService,
            LoanService,
            ManagerDeskService,
            PlayerColourPaletteService,
            PostgreSQLLeagueMembershipRepository,
            PrivateScoutingRepository,
            RulesService,
            SquadManagementService,
            SquadWorkspaceService,
            TeamSelectionService,
            ChipService,
            FixtureSummaryService,
            UserPreferenceService,
        )
    }
    owners.update({"KnockoutService", "HeadToHeadService"})

    for tool in TOOL_REGISTRY:
        assert set(tool.service.split(" | ")).issubset(owners)


def test_paginated_tools_have_bounded_page_sizes_and_cursors() -> None:
    paginated = [tool for tool in TOOL_REGISTRY if tool.paginated]

    assert paginated
    for tool in paginated:
        assert tool.input_schema["properties"]["limit"]["maximum"] == 100
        assert tool.input_schema["properties"]["cursor"]["type"] == "string"


def test_consequential_writes_are_never_write_scope_only() -> None:
    for tool in TOOL_REGISTRY:
        if tool.risk is ToolRisk.CONSEQUENTIAL:
            assert tool.scopes == frozenset({ToolScope.READ, ToolScope.WRITE})
            assert "idempotency_key" in tool.input_schema["required"]


def test_personal_reversible_writes_need_only_write_scope() -> None:
    for tool in TOOL_REGISTRY:
        if tool.risk is ToolRisk.PERSONAL_REVERSIBLE:
            assert tool.scopes == frozenset({ToolScope.WRITE})


def test_scope_filter_excludes_tools_that_need_ungranted_permissions() -> None:
    read_tools = list_tools(scopes=frozenset({ToolScope.READ}))

    assert read_tools
    assert all(tool.scopes == frozenset({ToolScope.READ}) for tool in read_tools)
    assert get_tool("update_my_preferences") not in read_tools
    assert get_tool("get_my_squad") is not None


def test_registry_does_not_publish_operational_or_incomplete_endpoints() -> None:
    names = {tool.name for tool in TOOL_REGISTRY}

    assert not any(
        "import" in name or "refresh" in name or "modernisation" in name for name in names
    )
    assert "approve_pending_request" in names


def test_public_tool_arguments_match_existing_service_contracts() -> None:
    assert set(get_tool("search_players").input_schema["properties"]) == set(
        ScoutingFilters.model_fields
    ) | {"limit", "cursor"}
    assert set(
        get_tool("save_my_lineup").input_schema["properties"]["players"]["items"]["properties"]
    ) == set(LineupUpdateRequest.model_fields["players"].annotation.__args__[0].model_fields)
    assert set(get_tool("propose_trade").input_schema["properties"]) - {"idempotency_key"} == set(
        TradeCreateRequest.model_fields
    )
    assert set(get_tool("request_player_loan").input_schema["properties"]) - {
        "idempotency_key"
    } == set(LoanCreateRequest.model_fields)
    assert set(
        get_tool("update_my_preferences").input_schema["properties"]["preferences"]["properties"]
    ) == set(UserPreferences.model_fields)
    assert set(get_tool("update_my_watchlist").input_schema["properties"]) == set(
        set(ScoutingNoteUpdate.model_fields) | {"player_id"}
    )
