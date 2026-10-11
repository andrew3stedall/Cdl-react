"""Typed catalogue of user-facing CDL actions available to AI clients.

This module describes contracts and policy metadata only. Transport adapters must
authorize each call and dispatch into the existing services; they must not call
repositories or reimplement domain rules directly.
"""

import importlib
import pkgutil
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from pydantic import BaseModel


class ToolScope(StrEnum):
    READ = "cdl:read"
    WRITE = "cdl:write"


class ToolRisk(StrEnum):
    READ = "read"
    PERSONAL_REVERSIBLE = "personal_reversible"
    CONSEQUENTIAL = "consequential"


class ToolRole(StrEnum):
    AUTHENTICATED = "authenticated"
    LEAGUE_MEMBER = "league_member"
    MANAGER = "manager"
    COMMISSIONER = "commissioner"
    ELIGIBLE_APPROVER = "eligible_approver"


@dataclass(frozen=True, slots=True)
class ToolDefinition:
    """Stable, transport-neutral description of one task-oriented tool."""

    name: str
    title: str
    description: str
    input_schema: dict[str, Any]
    response_contract: str
    response_schema: dict[str, Any]
    version: str
    scopes: frozenset[ToolScope]
    risk: ToolRisk
    required_role: ToolRole
    service: str
    paginated: bool = False


def _object(
    properties: dict[str, Any] | None = None,
    *,
    required: tuple[str, ...] = (),
    additional_properties: bool = False,
) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties or {},
        "required": list(required),
        "additionalProperties": additional_properties,
    }


def _contract_models() -> dict[str, type[BaseModel]]:
    """Discover concrete API response models from the existing contract package."""
    from cdl_api import contracts

    models: dict[str, type[BaseModel]] = {}
    for module in pkgutil.iter_modules(contracts.__path__):
        imported = importlib.import_module(f"{contracts.__name__}.{module.name}")
        for value in vars(imported).values():
            if isinstance(value, type) and issubclass(value, BaseModel):
                models[value.__name__] = value
    models.update(
        {
            "LiveDraftRoomResponse": models["DraftRoomView"],
            "LiveDraftPickResponse": models["DraftPickView"],
        }
    )
    return models


_CONTRACT_MODELS = _contract_models()


def _model_schema(model_name: str) -> dict[str, Any]:
    if model_name == "LeagueInviteRevocationResponse":
        return {
            "type": "object",
            "properties": {"revoked": {"type": "boolean"}},
            "required": ["revoked"],
            "additionalProperties": False,
        }
    if model_name == "LiveDraftCreatedResponse":
        return {
            "type": "object",
            "properties": {"id": {"type": "string"}, "status": {"type": "string"}},
            "required": ["id", "status"],
            "additionalProperties": False,
        }
    if model_name == "LiveDraftQueueResponse":
        return {
            "type": "object",
            "properties": {"player_ids": {"type": "array", "items": {"type": "string"}}},
            "required": ["player_ids"],
            "additionalProperties": False,
        }
    model = _CONTRACT_MODELS[model_name]
    return model.model_json_schema(ref_template="#/$defs/{model}")


def _response_schema(contract: str) -> dict[str, Any]:
    definitions: dict[str, Any] = {}

    def resolve(name: str) -> dict[str, Any]:
        if name.startswith("list[") and name.endswith("]"):
            return {"type": "array", "items": resolve(name[5:-1])}
        schema = _model_schema(name)
        definitions.update(schema.pop("$defs", {}))
        return schema

    if " | " in contract:
        variants = contract.split(" | ")
        data_schema: dict[str, Any] = {
            "oneOf": [{"type": "null"} if name == "null" else resolve(name) for name in variants]
        }
    else:
        data_schema = resolve(contract)

    result = {
        "type": "object",
        "properties": {
            "data": data_schema,
            "page": {
                "type": "object",
                "properties": {
                    "next_cursor": {"type": ["string", "null"]},
                    "has_more": {"type": "boolean"},
                },
                "required": ["next_cursor", "has_more"],
            },
        },
        "required": ["data", "page"],
        "additionalProperties": False,
    }
    if definitions:
        result["$defs"] = definitions
    return result


_PAGINATION = {
    "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 25},
    "cursor": {"type": "string", "minLength": 1, "maxLength": 512},
}
_EXECUTION_DECISION_SCHEMA = {
    "type": "object",
    "properties": {
        "status": {
            "type": "string",
            "enum": [
                "execution_grant_required",
                "approval_required",
                "state_changed",
                "idempotency_conflict",
                "approval_expired",
                "rejected",
                "stale",
                "expired",
                "completed",
                "in_progress",
                "execution_grant_expired",
                "execution_failed",
            ],
        },
        "proposal_id": {"type": "string"},
        "approval_url": {"type": "string", "format": "uri"},
        "message": {"type": "string"},
        "result": {},
    },
    "required": ["status"],
    "additionalProperties": True,
}
_READ = frozenset({ToolScope.READ})
_WRITE = frozenset({ToolScope.WRITE})
_BOTH = frozenset({ToolScope.READ, ToolScope.WRITE})


def _tool(
    name: str,
    title: str,
    description: str,
    properties: dict[str, Any] | None,
    scopes: frozenset[ToolScope],
    risk: ToolRisk,
    role: ToolRole,
    service: str,
    *,
    required: tuple[str, ...] = (),
    paginated: bool = False,
    response_contract: str = "CdlToolResult",
    conditional_required: tuple[tuple[dict[str, Any], tuple[str, ...]], ...] = (),
) -> ToolDefinition:
    schema_properties = dict(properties or {})
    required_fields = list(required)
    if risk is ToolRisk.CONSEQUENTIAL:
        schema_properties.setdefault(
            "idempotency_key",
            {"type": "string", "minLength": 1, "maxLength": 128},
        )
        if "idempotency_key" not in required_fields:
            required_fields.append("idempotency_key")
    if paginated:
        schema_properties.update(_PAGINATION)
    response_schema = _response_schema(response_contract)
    if risk is ToolRisk.CONSEQUENTIAL:
        data_schema = response_schema["properties"]["data"]
        response_schema["properties"]["data"] = {"oneOf": [data_schema, _EXECUTION_DECISION_SCHEMA]}
    return ToolDefinition(
        name=name,
        title=title,
        description=description,
        input_schema={
            **_object(schema_properties, required=tuple(required_fields)),
            **(
                {
                    "allOf": [
                        {"if": {"properties": condition}, "then": {"required": list(fields)}}
                        for condition, fields in conditional_required
                    ]
                }
                if conditional_required
                else {}
            ),
        },
        response_contract=response_contract,
        response_schema=response_schema,
        version="1.0.0",
        scopes=scopes,
        risk=risk,
        required_role=role,
        service=service,
        paginated=paginated,
    )


# Only current, user-facing capabilities are catalogued. Mutations carry their
# existing workflow classification; the execution gateway added in later issues
# enforces grants, approvals, ownership and lock rules before dispatch.
_TOOLS = (
    _tool(
        "get_my_squad",
        "Get my squad",
        "Return the authenticated manager's current squad and player ownership.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.LEAGUE_MEMBER,
        "SquadWorkspaceService",
        response_contract="SquadWorkspaceResponse",
    ),
    _tool(
        "get_my_team_selection",
        "Get my team selection",
        "Return the authenticated manager's lineup, captain, bench and chip state.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.MANAGER,
        "TeamSelectionService",
        response_contract="TeamSelectionResponse",
    ),
    _tool(
        "get_manager_desk",
        "Get my manager desk",
        "Return the authenticated manager's current actions and team summary.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.LEAGUE_MEMBER,
        "ManagerDeskService",
        response_contract="ManagerDeskResponse",
    ),
    _tool(
        "get_league_table",
        "Get league table",
        "Return the current standings for a league the authenticated user belongs to.",
        {
            "mode": {"type": "string", "enum": ["official", "live"], "default": "official"},
        },
        _READ,
        ToolRisk.READ,
        ToolRole.LEAGUE_MEMBER,
        "LeagueTableService",
        response_contract="LeagueTableResponse",
    ),
    _tool(
        "get_league_fixtures",
        "Get league fixtures",
        "Return scheduled or completed league fixtures, with bounded pagination.",
        {
            "period": {"type": "string", "enum": ["current", "next", "all"], "default": "all"},
        },
        _READ,
        ToolRisk.READ,
        ToolRole.LEAGUE_MEMBER,
        "FixtureService",
        paginated=True,
        response_contract="LeagueFixturesResponse",
    ),
    _tool(
        "search_players",
        "Search players",
        "Search the available player pool using supported filters.",
        {
            "position": {"type": "string", "enum": ["GKP", "DEF", "MID", "FWD"]},
            "draft_team_id": {"type": "string"},
            "epl_team_id": {"type": "string"},
            "query": {"type": "string", "maxLength": 100},
            "metric": {"type": "string", "enum": ["total_points", "form", "value"]},
        },
        _READ,
        ToolRisk.READ,
        ToolRole.LEAGUE_MEMBER,
        "SquadManagementService",
        paginated=True,
        response_contract="ScoutingPlayersResponse",
    ),
    _tool(
        "get_player_detail",
        "Get player detail",
        "Return player profile, form and supported history for a player.",
        {"player_id": {"type": "string", "minLength": 1}},
        _READ,
        ToolRisk.READ,
        ToolRole.AUTHENTICATED,
        "SquadManagementService",
        required=("player_id",),
        response_contract="PlayerDetail",
    ),
    _tool(
        "search_rules",
        "Search league rules",
        "Search the published rules knowledge base, optionally by category.",
        {
            "query": {"type": "string", "maxLength": 100},
            "category": {
                "type": "string",
                "enum": [
                    "draft",
                    "squads",
                    "transfers",
                    "trades",
                    "matchday",
                    "chips",
                    "league",
                    "playoffs",
                    "commissioner",
                ],
            },
        },
        _READ,
        ToolRisk.READ,
        ToolRole.AUTHENTICATED,
        "RulesService",
        paginated=True,
        response_contract="RulesIndexResponse",
    ),
    _tool(
        "get_fixture_difficulty",
        "Get fixture difficulty",
        "Return fixture difficulty ratings for a season and gameweek range.",
        {
            "season": {"type": "string", "minLength": 4, "maxLength": 9},
            "team_id": {"type": "string"},
            "gameweek_start": {"type": "integer", "minimum": 1, "maximum": 38},
            "gameweek_end": {"type": "integer", "minimum": 1, "maximum": 38},
            "view": {"type": "string", "enum": ["combined", "attack", "defence"]},
        },
        _READ,
        ToolRisk.READ,
        ToolRole.AUTHENTICATED,
        "FixtureDifficultyService",
        response_contract="FixtureDifficultyCombinedResponse | FixtureDifficultyResponse",
    ),
    _tool(
        "get_dashboard_metrics",
        "Get dashboard metrics",
        "Return the supported metric catalogue for the dashboard.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.LEAGUE_MEMBER,
        "DashboardService",
        response_contract="list[DashboardMetric]",
    ),
    _tool(
        "get_my_preferences",
        "Get my preferences",
        "Return the authenticated user's personal display and app preferences.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.AUTHENTICATED,
        "UserPreferenceService",
        response_contract="UserPreferences",
    ),
    _tool(
        "update_my_preferences",
        "Update my preferences",
        "Update reversible personal display and app preferences for the authenticated user.",
        {
            "preferences": {
                "type": "object",
                "properties": {
                    "theme_preset": {"type": "string"},
                    "attack_direction": {"type": "string"},
                    "fdr_scale": {"type": "string"},
                    "fdr_scale_reversed": {"type": "boolean"},
                    "fdr_display_mode": {"type": "string"},
                    "position_colour_scale": {"type": "string"},
                    "position_colour_mode": {"type": "string"},
                    "position_custom_gkp": {"type": "string"},
                    "position_custom_def": {"type": "string"},
                    "position_custom_mid": {"type": "string"},
                    "position_custom_fwd": {"type": "string"},
                    "metric_colour_scale": {"type": "string"},
                    "metric_colour_scale_reversed": {"type": "boolean"},
                    "metric_custom_1": {"type": "string"},
                    "metric_custom_2": {"type": "string"},
                    "metric_custom_3": {"type": "string"},
                    "metric_custom_4": {"type": "string"},
                    "metric_custom_5": {"type": "string"},
                    "result_win_colour": {"type": "string"},
                    "result_draw_colour": {"type": "string"},
                    "result_loss_colour": {"type": "string"},
                    "light_theme_colour": {"type": "string"},
                    "dark_theme_colour": {"type": "string"},
                    "primary_theme_colour": {"type": "string"},
                    "secondary_theme_colour": {"type": "string"},
                    "tertiary_theme_colour": {"type": "string"},
                    "quaternary_theme_colour": {"type": "string"},
                    "theme_colour_variants": {"type": "object"},
                    "fdr_custom_min": {"type": "string"},
                    "fdr_custom_second": {"type": "string"},
                    "fdr_custom_mid": {"type": "string"},
                    "fdr_custom_fourth": {"type": "string"},
                    "fdr_custom_max": {"type": "string"},
                },
                "additionalProperties": False,
            }
        },
        _WRITE,
        ToolRisk.PERSONAL_REVERSIBLE,
        ToolRole.AUTHENTICATED,
        "UserPreferenceService",
        required=("preferences",),
        response_contract="UserPreferences",
    ),
    _tool(
        "get_my_watchlist",
        "Get my player watchlist",
        "Return the authenticated user's private player watchlist.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.MANAGER,
        "PrivateScoutingRepository",
        paginated=True,
        response_contract="list[ScoutingNote]",
    ),
    _tool(
        "update_my_watchlist",
        "Update my player watchlist",
        "Set whether a player is watchlisted and update its private scouting note.",
        {
            "player_id": {"type": "string", "minLength": 1},
            "watchlisted": {"type": "boolean"},
            "note": {"type": "string", "maxLength": 4000, "default": ""},
        },
        _WRITE,
        ToolRisk.PERSONAL_REVERSIBLE,
        ToolRole.MANAGER,
        "PrivateScoutingRepository",
        required=("player_id", "watchlisted"),
        response_contract="ScoutingNote",
    ),
    _tool(
        "save_my_lineup",
        "Save my lineup",
        "Save a lineup for the authenticated manager using existing formation, deadline "
        "and lock rules.",
        {
            "gameweek": {"type": "integer", "minimum": 1, "maximum": 38},
            "players": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "player_id": {"type": "string", "minLength": 1},
                        "slot": {"type": "string", "enum": ["starter", "bench", "reserve"]},
                        "slot_order": {"type": "integer", "minimum": 0},
                        "is_captain": {"type": "boolean"},
                        "is_vice_captain": {"type": "boolean"},
                    },
                    "required": ["player_id", "slot", "slot_order"],
                    "additionalProperties": False,
                },
            },
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.MANAGER,
        "TeamSelectionService",
        required=("players",),
        response_contract="TeamSelectionResponse",
    ),
    _tool(
        "propose_trade",
        "Propose a trade",
        "Propose a player trade and retain current participant and approval workflows.",
        {
            "offered_to_team_id": {"type": "string", "minLength": 1},
            "offered_player_ids": {"type": "array", "items": {"type": "string"}, "minItems": 1},
            "requested_player_ids": {"type": "array", "items": {"type": "string"}, "minItems": 1},
            "note": {"type": ["string", "null"], "maxLength": 512},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.MANAGER,
        "SquadManagementService",
        required=("offered_to_team_id", "offered_player_ids", "requested_player_ids"),
        response_contract="TradeProposal",
    ),
    _tool(
        "request_player_loan",
        "Request a player loan",
        "Request a loan using existing eligibility, consent and commissioner approval rules.",
        {
            "player_id": {"type": "string", "minLength": 1},
            "borrower_team_id": {"type": "string", "minLength": 1},
            "duration_gameweeks": {"type": "integer", "minimum": 4},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.MANAGER,
        "LoanService",
        required=("player_id", "borrower_team_id"),
        response_contract="LoanResponse",
    ),
    _tool(
        "approve_pending_request",
        "Approve a pending league request",
        "Approve an eligible pending trade or loan request while enforcing "
        "conflict-of-interest rules.",
        {
            "request_id": {"type": "string", "minLength": 1},
            "request_type": {"type": "string", "enum": ["trade", "loan"]},
            "decision": {"type": "string", "enum": ["approved", "rejected"]},
            "note": {"type": ["string", "null"], "maxLength": 512},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.ELIGIBLE_APPROVER,
        "SquadManagementService | LoanService",
        required=("request_id", "request_type", "decision"),
        response_contract="TradeProposal | LoanResponse",
    ),
    _tool(
        "update_my_chip",
        "Update my chip",
        "Activate or deactivate a chip for the authenticated manager using existing "
        "chip and deadline rules.",
        {"chip_id": {"type": "string", "minLength": 1}, "active": {"type": "boolean"}},
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.MANAGER,
        "ChipService",
        required=("chip_id", "active"),
        response_contract="TeamSelectionResponse",
    ),
    _tool(
        "apply_squad_changes",
        "Apply squad changes",
        "Add or remove players from the authenticated manager's squad, subject to existing rules.",
        {
            "add_player_ids": {"type": "array", "items": {"type": "string"}},
            "remove_player_ids": {"type": "array", "items": {"type": "string"}},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.MANAGER,
        "SquadManagementService",
        response_contract="SquadSummaryResponse",
    ),
    _tool(
        "respond_to_trade",
        "Respond to a trade",
        "Accept, reject or cancel a trade proposal involving the authenticated manager.",
        {
            "trade_id": {"type": "string", "minLength": 1},
            "status": {"type": "string", "enum": ["accepted", "rejected", "cancelled"]},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.MANAGER,
        "SquadManagementService",
        required=("trade_id", "status"),
        response_contract="TradeProposal",
    ),
    _tool(
        "decide_loan_request",
        "Respond to a loan request",
        "Accept, reject or cancel a loan request involving the authenticated manager.",
        {
            "loan_id": {"type": "string", "minLength": 1},
            "status": {"type": "string", "enum": ["agreed", "rejected", "cancelled"]},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.MANAGER,
        "LoanService",
        required=("loan_id", "status"),
        response_contract="LoanResponse",
    ),
    _tool(
        "submit_free_agency_preferences",
        "Submit free agency preferences",
        "Submit the authenticated manager's ranked player preferences for an open draw.",
        {
            "draw_id": {"type": "string", "minLength": 1},
            "player_ids": {"type": "array", "items": {"type": "string"}, "maxItems": 100},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.MANAGER,
        "FreeAgencyDrawService",
        required=("draw_id", "player_ids"),
        response_contract="list[FreeAgencyPreference]",
    ),
    _tool(
        "manage_free_agency_draw",
        "Manage a free agency draw",
        "Create or advance a free agency draw using existing commissioner workflow and validation.",
        {
            "action": {"type": "string", "enum": ["create", "open", "lock", "process"]},
            "draw_id": {"type": "string"},
            "gameweek": {"type": "integer", "minimum": 1, "maximum": 38},
            "opens_at": {"type": ["string", "null"], "format": "date-time"},
            "closes_at": {"type": "string", "format": "date-time"},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.COMMISSIONER,
        "FreeAgencyDrawService",
        required=("action",),
        conditional_required=(
            ({"action": {"const": "create"}}, ("gameweek", "closes_at")),
            ({"action": {"const": "open"}}, ("draw_id",)),
            ({"action": {"const": "lock"}}, ("draw_id",)),
            ({"action": {"const": "process"}}, ("draw_id",)),
        ),
        response_contract="FreeAgencyDrawResponse",
    ),
    _tool(
        "manage_league_invite",
        "Manage a league invite",
        "Create or revoke an invite for a team in a league managed by the "
        "authenticated commissioner.",
        {
            "action": {"type": "string", "enum": ["create", "revoke"]},
            "team_id": {"type": "string"},
            "invite_id": {"type": "string"},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.COMMISSIONER,
        "PostgreSQLLeagueMembershipRepository | InMemoryLeagueMembershipRepository",
        required=("action",),
        conditional_required=(
            ({"action": {"const": "create"}}, ("team_id",)),
            ({"action": {"const": "revoke"}}, ("invite_id",)),
        ),
        response_contract="LeagueInviteResponse | LeagueInviteRevocationResponse",
    ),
    _tool(
        "get_live_draft_room",
        "Get live draft room",
        "Return the live draft state available to the authenticated league member.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.LEAGUE_MEMBER,
        "LiveDraftService",
        response_contract="LiveDraftRoomResponse",
    ),
    _tool(
        "make_live_draft_pick",
        "Make a live draft pick",
        "Make the authenticated manager's current draft pick, subject to draft "
        "state and turn rules.",
        {
            "player_id": {"type": "string", "minLength": 1},
            "idempotency_key": {"type": "string", "minLength": 1, "maxLength": 128},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.MANAGER,
        "LiveDraftService",
        required=("player_id", "idempotency_key"),
        response_contract="LiveDraftPickResponse",
    ),
    _tool(
        "manage_player_interest",
        "Manage player interest",
        "Create or remove an interest record for a player in the authenticated manager's league.",
        {
            "action": {"type": "string", "enum": ["create", "remove"]},
            "player_id": {"type": "string", "minLength": 1},
            "interest_id": {"type": "string"},
            "note": {"type": ["string", "null"], "maxLength": 512},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.MANAGER,
        "SquadManagementService",
        required=("action",),
        conditional_required=(
            ({"action": {"const": "create"}}, ("player_id",)),
            ({"action": {"const": "remove"}}, ("interest_id",)),
        ),
        response_contract="InterestResponse | InterestDeleteResponse",
    ),
    _tool(
        "list_my_loans",
        "Get my league loans",
        "Return loan agreements visible to the authenticated league manager.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.MANAGER,
        "LoanService",
        paginated=True,
        response_contract="LoanAgreementsResponse",
    ),
    _tool(
        "get_free_agency_draw_results",
        "Get free agency draw results",
        "Return published results and the authenticated manager's own outcome for a draw.",
        {"draw_id": {"type": "string", "minLength": 1}},
        _READ,
        ToolRisk.READ,
        ToolRole.MANAGER,
        "FreeAgencyDrawService",
        required=("draw_id",),
        response_contract="FreeAgencyResultsResponse",
    ),
    _tool(
        "update_live_draft_queue",
        "Update my live draft queue",
        "Set the authenticated manager's player queue for the live draft.",
        {"player_ids": {"type": "array", "items": {"type": "string"}, "maxItems": 500}},
        _WRITE,
        ToolRisk.PERSONAL_REVERSIBLE,
        ToolRole.MANAGER,
        "LiveDraftService",
        required=("player_ids",),
        response_contract="LiveDraftQueueResponse",
    ),
    _tool(
        "control_live_draft_room",
        "Control live draft room",
        "Create, start, pause, resume or complete a draft room as its authorized commissioner.",
        {
            "action": {
                "type": "string",
                "enum": ["create", "start", "pause", "resume", "complete"],
            },
            "mode": {"type": "string", "enum": ["random_repeat", "snake", "manual"]},
            "rounds": {"type": "integer", "const": 20},
            "clock_enabled": {"type": "boolean"},
            "pick_seconds": {"type": ["integer", "null"], "minimum": 10, "maximum": 3600},
            "manual_team_order": {"type": ["array", "null"], "items": {"type": "string"}},
        },
        _BOTH,
        ToolRisk.CONSEQUENTIAL,
        ToolRole.COMMISSIONER,
        "LiveDraftService",
        required=("action",),
        conditional_required=(({"action": {"const": "create"}}, ("mode",)),),
        response_contract="LiveDraftCreatedResponse | LiveDraftRoomResponse",
    ),
    _tool(
        "manage_colour_palette",
        "Manage a personal colour palette",
        "Create or remove one of the authenticated user's personal FDR or player colour palettes.",
        {
            "action": {"type": "string", "enum": ["create", "delete"]},
            "palette_type": {"type": "string", "enum": ["fdr", "player"]},
            "palette_id": {"type": "string"},
            "name": {"type": "string", "minLength": 1, "maxLength": 80},
            "family": {"type": "string", "enum": ["position", "metric"]},
            "colours": {
                "type": "array",
                "items": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
                "minItems": 4,
                "maxItems": 5,
            },
            "mode": {"type": "string", "enum": ["anchors", "all"]},
            "min": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
            "second": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
            "mid": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
            "fourth": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
            "max": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
        },
        _WRITE,
        ToolRisk.PERSONAL_REVERSIBLE,
        ToolRole.AUTHENTICATED,
        "FdrCustomPaletteService | PlayerColourPaletteService",
        required=("action", "palette_type"),
        conditional_required=(
            ({"action": {"const": "delete"}}, ("palette_id",)),
            (
                {"action": {"const": "create"}, "palette_type": {"const": "fdr"}},
                ("name", "mode", "min", "second", "mid", "fourth", "max"),
            ),
            (
                {"action": {"const": "create"}, "palette_type": {"const": "player"}},
                ("name", "family", "colours"),
            ),
        ),
        response_contract="FdrCustomPalette | PlayerColourPalette | null",
    ),
    _tool(
        "get_player_history",
        "Get player history",
        "Return the supported FPL gameweek history for a player.",
        {"player_id": {"type": "string", "minLength": 1}},
        _READ,
        ToolRisk.READ,
        ToolRole.AUTHENTICATED,
        "FplDataService",
        required=("player_id",),
        response_contract="FplPlayerHistoryResponse",
    ),
    _tool(
        "get_league_competition_results",
        "Get league competition results",
        "Return knockout bracket or head-to-head history for a league the user belongs to.",
        {
            "league_id": {"type": "string", "minLength": 1},
            "competition": {"type": "string", "enum": ["knockout", "head_to_head"]},
        },
        _READ,
        ToolRisk.READ,
        ToolRole.LEAGUE_MEMBER,
        "KnockoutService | HeadToHeadService",
        required=("competition",),
        response_contract="KnockoutResponse | HeadToHeadResponse",
    ),
    _tool(
        "get_fixture_detail",
        "Get fixture detail",
        "Return supported scoring and fixture details for one league fixture.",
        {"fixture_id": {"type": "string", "minLength": 1}},
        _READ,
        ToolRisk.READ,
        ToolRole.LEAGUE_MEMBER,
        "FixtureService",
        required=("fixture_id",),
        response_contract="FixtureDetailResponse",
    ),
    _tool(
        "list_pending_approvals",
        "List pending trade and loan approvals",
        "Return pending approvals that the authenticated user is eligible to review.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.ELIGIBLE_APPROVER,
        "SquadManagementService | LoanService",
        paginated=True,
        response_contract="PendingApprovalsResponse",
    ),
    _tool(
        "get_loan_events",
        "Get loan history",
        "Return the event history for a loan visible to the authenticated manager.",
        {"loan_id": {"type": "string", "minLength": 1}},
        _READ,
        ToolRisk.READ,
        ToolRole.MANAGER,
        "LoanService",
        required=("loan_id",),
        response_contract="LoanEventsResponse",
    ),
    _tool(
        "get_league_management",
        "Get league management summary",
        "Return the teams and assigned managers for a league managed by the "
        "authenticated commissioner.",
        {"league_id": {"type": "string", "minLength": 1}},
        _READ,
        ToolRisk.READ,
        ToolRole.COMMISSIONER,
        "PostgreSQLLeagueMembershipRepository | InMemoryLeagueMembershipRepository",
        response_contract="LeagueManagementResponse",
    ),
    _tool(
        "list_trade_proposals",
        "List my trade proposals",
        "Return trade proposals visible to the authenticated manager.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.MANAGER,
        "SquadManagementService",
        paginated=True,
        response_contract="TradesResponse",
    ),
    _tool(
        "get_trade_audit",
        "Get trade history",
        "Return the audit events for a trade visible to the authenticated manager.",
        {"trade_id": {"type": "string", "minLength": 1}},
        _READ,
        ToolRisk.READ,
        ToolRole.MANAGER,
        "SquadManagementService",
        required=("trade_id",),
        response_contract="list[TradeAuditEventResponse]",
    ),
    _tool(
        "get_squad_notifications",
        "Get my squad notifications",
        "Return actionable squad and trade notifications for the authenticated manager.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.MANAGER,
        "SquadManagementService",
        response_contract="SquadNotificationsResponse",
    ),
    _tool(
        "get_fpl_data_status",
        "Get FPL data status",
        "Return freshness and availability for cached FPL reference data.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.AUTHENTICATED,
        "FplDataService",
        response_contract="FplCacheStatusResponse",
    ),
    _tool(
        "list_free_agency_draws",
        "List free agency draws",
        "Return free agency draws visible to the authenticated manager.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.MANAGER,
        "FreeAgencyDrawService",
        paginated=True,
        response_contract="list[FreeAgencyDrawResponse]",
    ),
    _tool(
        "query_dashboard_widget",
        "Query a dashboard widget",
        "Return a configured dashboard widget with validated filters and a bounded result size.",
        {
            "widget_id": {"type": "string", "minLength": 1},
            "filters": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "filter_id": {"type": "string", "minLength": 1},
                        "value": {"type": "string"},
                    },
                    "required": ["filter_id", "value"],
                    "additionalProperties": False,
                },
            },
            "drilldown_dimension_id": {"type": ["string", "null"]},
            "limit": {"type": "integer", "minimum": 1, "maximum": 50, "default": 10},
        },
        _READ,
        ToolRisk.READ,
        ToolRole.LEAGUE_MEMBER,
        "WidgetQueryService",
        required=("widget_id",),
        response_contract="WidgetQueryResponse",
    ),
    _tool(
        "get_player_ownership_history",
        "Get player ownership history",
        "Return CDL ownership periods for a player when available to the "
        "authenticated league manager.",
        {"player_id": {"type": "string", "minLength": 1}},
        _READ,
        ToolRisk.READ,
        ToolRole.MANAGER,
        "PrivateScoutingRepository",
        required=("player_id",),
        response_contract="OwnershipHistory",
    ),
    _tool(
        "get_team_selection_fixture_summary",
        "Get team selection fixture summary",
        "Return CDL and EPL fixtures and tables for the authenticated manager's selection.",
        None,
        _READ,
        ToolRisk.READ,
        ToolRole.MANAGER,
        "FixtureSummaryService",
        response_contract="FixtureSummaryPanel",
    ),
)


TOOL_REGISTRY: tuple[ToolDefinition, ...] = _TOOLS
_TOOLS_BY_NAME = {tool.name: tool for tool in TOOL_REGISTRY}


def get_tool(name: str) -> ToolDefinition | None:
    """Return the registered tool by stable name, if it exists."""

    return _TOOLS_BY_NAME.get(name)


def list_tools(*, scopes: frozenset[ToolScope] | None = None) -> tuple[ToolDefinition, ...]:
    """List tools, optionally filtering to those covered by granted scopes."""

    if scopes is None:
        return TOOL_REGISTRY
    return tuple(tool for tool in TOOL_REGISTRY if tool.scopes.issubset(scopes))
