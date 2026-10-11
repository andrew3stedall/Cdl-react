"""Shared authorization and execution gateway used by both MCP transports."""

import hashlib
import json
from typing import Any, Protocol

from fastapi.encoders import jsonable_encoder

from cdl_api.ai_tools.registry import ToolDefinition, ToolRisk, ToolRole
from cdl_api.repositories.factory import build_repositories
from cdl_api.services.ai_execution import AIExecutionPolicy
from cdl_api.services.preferences import UserPreferenceService
from cdl_api.settings import Settings


class ToolDispatcher(Protocol):
    """Allowlisted service adapters over existing CDL domain services."""

    def state_version(
        self, tool: ToolDefinition, arguments: dict[str, Any], *, user_id: str
    ) -> str: ...

    def execute(self, tool: ToolDefinition, arguments: dict[str, Any], *, user_id: str) -> Any: ...


class ExistingServiceDispatcher:
    """Dispatch registry reads through existing CDL services and repositories."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def state_version(
        self, tool: ToolDefinition, arguments: dict[str, Any], *, user_id: str
    ) -> str:
        snapshots = {
            "save_my_lineup": "get_my_team_selection",
            "update_my_chip": "get_my_team_selection",
            "apply_squad_changes": "get_my_squad",
            "propose_trade": ("get_my_squad", "list_trade_proposals"),
            "respond_to_trade": "list_trade_proposals",
            "approve_pending_request": "list_pending_approvals",
            "request_player_loan": ("get_my_squad", "list_my_loans"),
            "decide_loan_request": "list_my_loans",
            "submit_free_agency_preferences": "list_free_agency_draws",
            "manage_free_agency_draw": "list_free_agency_draws",
            "manage_league_invite": "get_league_management",
            "make_live_draft_pick": "get_live_draft_room",
            "update_live_draft_queue": "get_live_draft_room",
            "control_live_draft_room": "get_live_draft_room",
            "manage_player_interest": "get_my_squad",
            "manage_colour_palette": "get_my_preferences",
        }
        snapshot_tool = snapshots.get(tool.name)
        if snapshot_tool is None:
            raise NotImplementedError(f"No state-version adapter for '{tool.name}'.")
        from cdl_api.ai_tools.registry import get_tool

        snapshot_names = (
            list(snapshot_tool) if isinstance(snapshot_tool, tuple) else [snapshot_tool]
        )
        snapshot: dict[str, Any] = {}
        for name in snapshot_names:
            definition = get_tool(name)
            if definition is None:
                raise NotImplementedError(f"Read snapshot '{name}' is not registered.")
            snapshot[name] = self.execute(definition, {}, user_id=user_id)
        if tool.name == "manage_player_interest":
            snapshot["interests"] = self._squad_service(user_id).list_interests()
        encoded = json.dumps(
            jsonable_encoder(snapshot), sort_keys=True, separators=(",", ":"), default=str
        ).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def execute(self, tool: ToolDefinition, arguments: dict[str, Any], *, user_id: str) -> Any:
        repositories = build_repositories(self.settings)
        name = tool.name
        if tool.name == "get_my_preferences":
            return UserPreferenceService(repositories.preferences).get_preferences(user_id)
        if tool.name == "update_my_preferences":
            from cdl_api.contracts.theme import UserPreferences

            preferences = UserPreferences.model_validate(arguments.get("preferences", {}))
            return UserPreferenceService(repositories.preferences).update_preferences(
                user_id, preferences
            )
        if name in {
            "get_my_squad",
            "get_manager_desk",
            "get_my_team_selection",
            "get_team_selection_fixture_summary",
            "search_players",
            "get_player_detail",
            "get_squad_notifications",
            "list_trade_proposals",
            "get_trade_audit",
        }:
            from cdl_api.contracts.squad import ScoutingFilters
            from cdl_api.database import build_session_factory
            from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
            from cdl_api.repositories.postgres_team_selection import (
                PostgreSQLTeamSelectionRepository,
            )
            from cdl_api.services.manager_desk import ManagerDeskService
            from cdl_api.services.squad import SquadManagementService
            from cdl_api.services.squad_workspace import SquadWorkspaceService
            from cdl_api.services.team_selection import FixtureSummaryService, TeamSelectionService
            from cdl_api.staging_draft_seed import UnassignedManagerContextError

            if self.settings.repository_mode == "postgres":
                factory = build_session_factory(self.settings)
                try:
                    squad_repository = PostgreSQLSquadRepository(factory, user_id=user_id)
                    selection_repository = PostgreSQLTeamSelectionRepository(
                        factory, user_id=user_id
                    )
                except UnassignedManagerContextError as exc:
                    raise PermissionError("An assigned league manager is required.") from exc
            else:
                squad_repository = repositories.squad
                selection_repository = repositories.team_selection
            squad = SquadManagementService(squad_repository)
            if name == "get_my_squad":
                return SquadWorkspaceService(squad).get_workspace()
            if name == "get_manager_desk":
                return ManagerDeskService(
                    TeamSelectionService(selection_repository), squad, repositories.league
                ).get_desk()
            if name == "get_my_team_selection":
                return TeamSelectionService(selection_repository).get_team_selection()
            if name == "get_team_selection_fixture_summary":
                return FixtureSummaryService(selection_repository).get_summary()
            if name == "search_players":
                return squad.scout_players(
                    ScoutingFilters.model_validate(
                        {key: value for key, value in arguments.items() if value is not None}
                    )
                )
            if name == "get_player_detail":
                player = squad.get_player(str(arguments["player_id"]))
                if player is None:
                    raise LookupError("Player not found.")
                return player
            if name == "get_squad_notifications":
                return squad.notifications()
            if name == "list_trade_proposals":
                from cdl_api.contracts.squad import TradesResponse

                return TradesResponse(trades=squad.list_trades())
            return squad.trade_audit(str(arguments["trade_id"]), user_id)
        if name in {
            "get_league_table",
            "get_league_fixtures",
            "get_fixture_detail",
            "get_league_competition_results",
        }:
            from cdl_api.services.league_service import (
                FixtureService,
                HeadToHeadService,
                KnockoutService,
                LeagueTableService,
            )

            fixture = FixtureService(repositories.league)
            if name == "get_league_table":
                return LeagueTableService(repositories.league).get_table(
                    str(arguments.get("mode", "official"))
                )
            if name == "get_league_fixtures":
                method = {
                    "all": fixture.list_all,
                    "current": fixture.list_current,
                    "next": fixture.list_next,
                }[str(arguments.get("period", "all"))]
                return method()
            if name == "get_fixture_detail":
                detail = fixture.get_detail(str(arguments["fixture_id"]))
                if detail is None:
                    raise LookupError("Fixture not found.")
                return detail
            if name == "get_league_competition_results":
                from cdl_api.staging_draft_seed import LEAGUE_ID

                if arguments.get("league_id") not in {None, LEAGUE_ID}:
                    raise LookupError("League not found.")
            if str(arguments["competition"]) == "knockout":
                return KnockoutService(repositories.league).get_knockout()
            return HeadToHeadService(repositories.league).get_records()
        if name == "search_rules":
            from cdl_api.contracts.rules_models import RuleCategory
            from cdl_api.services.rules_service import RulesService

            category = arguments.get("category")
            return RulesService().search_rules(
                str(arguments.get("query", "")),
                RuleCategory(category) if category else None,
            )
        if name == "get_fixture_difficulty":
            from cdl_api.contracts.fdr import FixtureDifficultyFilters, FixtureDifficultyView
            from cdl_api.database import build_session_factory
            from cdl_api.repositories.fdr_repository import FixtureDifficultyRepository
            from cdl_api.repositories.postgres_fdr import PostgreSQLFixtureDifficultyRepository
            from cdl_api.services.fdr_service import FixtureDifficultyService

            repository = (
                PostgreSQLFixtureDifficultyRepository(build_session_factory(self.settings))
                if self.settings.repository_mode == "postgres"
                else FixtureDifficultyRepository()
            )
            filters = FixtureDifficultyFilters.model_validate(arguments)
            service = FixtureDifficultyService(repository)
            view = arguments.get("view", "combined")
            return (
                service.get_combined(filters)
                if view == "combined"
                else service.get_view(FixtureDifficultyView(view), filters)
            )
        if name == "get_dashboard_metrics":
            from cdl_api.database import build_session_factory
            from cdl_api.repositories.dashboard_repository import DashboardRepository
            from cdl_api.repositories.postgres_dashboard_metrics import (
                PostgreSQLDashboardMetricRepository,
            )
            from cdl_api.services.dashboard_service import MetricCatalogService

            repository = (
                PostgreSQLDashboardMetricRepository(build_session_factory(self.settings))
                if self.settings.repository_mode == "postgres"
                else DashboardRepository()
            )
            return MetricCatalogService(repository).list_metrics()
        if name in {"get_my_watchlist", "get_player_ownership_history"}:
            if self.settings.repository_mode != "postgres":
                raise NotImplementedError("Private scouting reads require PostgreSQL storage.")
            from cdl_api.database import build_session_factory
            from cdl_api.repositories.private_scouting import PrivateScoutingRepository
            from cdl_api.staging_draft_seed import LEAGUE_ID, resolve_staging_manager_context

            factory = build_session_factory(self.settings)
            resolve_staging_manager_context(factory, user_id)
            repository = PrivateScoutingRepository(factory, user_id, LEAGUE_ID)
            if name == "get_my_watchlist":
                return repository.list_watchlist()
            return repository.ownership_history(str(arguments["player_id"]))
        if name == "update_my_watchlist":
            if self.settings.repository_mode != "postgres":
                raise NotImplementedError("Private scouting writes require PostgreSQL storage.")
            from cdl_api.contracts.scouting import ScoutingNoteUpdate
            from cdl_api.database import build_session_factory
            from cdl_api.repositories.private_scouting import PrivateScoutingRepository
            from cdl_api.staging_draft_seed import LEAGUE_ID, resolve_staging_manager_context

            factory = build_session_factory(self.settings)
            resolve_staging_manager_context(factory, user_id)
            return PrivateScoutingRepository(factory, user_id, LEAGUE_ID).save_note(
                str(arguments["player_id"]),
                ScoutingNoteUpdate(
                    watchlisted=bool(arguments["watchlisted"]),
                    note=str(arguments.get("note", "")),
                ),
            )
        if name == "manage_colour_palette":
            from cdl_api.contracts.theme import FdrCustomPaletteCreate, PlayerColourPaletteCreate
            from cdl_api.services.fdr_custom_palettes import FdrCustomPaletteService
            from cdl_api.services.player_colour_palettes import PlayerColourPaletteService

            action = str(arguments["action"])
            palette_type = str(arguments["palette_type"])
            if palette_type == "fdr":
                service = FdrCustomPaletteService(repositories.fdr_custom_palettes)
                if action == "delete":
                    service.delete_palette(user_id, str(arguments["palette_id"]))
                    return None
                return service.create_palette(
                    user_id, FdrCustomPaletteCreate.model_validate(arguments)
                )
            service = PlayerColourPaletteService(repositories.player_colour_palettes)
            if action == "delete":
                service.delete_palette(user_id, str(arguments["palette_id"]))
                return None
            return service.create_palette(
                user_id, PlayerColourPaletteCreate.model_validate(arguments)
            )
        if name in {"list_my_loans", "get_loan_events"}:
            service = self._loan_service(user_id)
            if name == "list_my_loans":
                from cdl_api.contracts.loans import LoanAgreementsResponse

                return LoanAgreementsResponse(loans=service.list_for_manager())
            events = service.events(str(arguments["loan_id"]))
            if events is None:
                raise LookupError("Loan not found.")
            return events
        if name in {"list_free_agency_draws", "get_free_agency_draw_results"}:
            service = self._free_agency_service(user_id)
            if name == "list_free_agency_draws":
                return service.list_draws()
            results = service.results(str(arguments["draw_id"]))
            if results is None:
                raise LookupError("Free-agency draw not found.")
            return results
        if name == "get_live_draft_room":
            if self.settings.repository_mode != "postgres":
                raise NotImplementedError("Live draft reads require PostgreSQL storage.")
            from cdl_api.database import build_session_factory
            from cdl_api.services.live_draft import LiveDraftService

            service = LiveDraftService(build_session_factory(self.settings))
            membership = service.membership(user_id)
            if membership is None:
                raise PermissionError("Current league membership is required.")
            return service.room(
                user_id,
                membership.get("team_id"),
                membership.get("role", "manager"),
                advance_expired_pick=False,
            )
        if name in {"get_fpl_data_status", "get_player_history"}:
            service = self._fpl_service()
            return (
                service.status()
                if name == "get_fpl_data_status"
                else service.player_history(str(arguments["player_id"]))
            )
        if name == "get_league_management":
            try:
                league_name, available_team_count, teams = (
                    repositories.league_memberships.league_management()
                )
            except LookupError:
                raise LookupError("League management data not found.") from None
            from cdl_api.staging_draft_seed import LEAGUE_ID

            if arguments.get("league_id") != LEAGUE_ID:
                raise LookupError("League not found.")
            from cdl_api.contracts.league_models import LeagueManagementResponse

            return LeagueManagementResponse(
                league_name=league_name,
                available_team_count=available_team_count,
                teams=[
                    {
                        "team_id": team.team_id,
                        "team_name": team.team_name,
                        "manager_name": team.manager_name,
                        "manager_email": team.manager_email,
                        "is_assigned": team.is_assigned,
                    }
                    for team in teams
                ],
            )
        if name == "list_pending_approvals":
            from cdl_api.contracts.ai_execution import PendingApprovalsResponse

            return PendingApprovalsResponse(
                trades=self._squad_service(user_id).list_pending_trade_approvals(user_id),
                loans=self._loan_service(user_id).list_pending_approvals(),
            )
        if name == "update_live_draft_queue":
            self._require_actor_scoped_storage()
            from cdl_api.database import build_session_factory
            from cdl_api.services.live_draft import LiveDraftService

            service = LiveDraftService(build_session_factory(self.settings))
            membership = service.membership(user_id)
            team_id = membership.get("team_id") if membership else None
            if not team_id:
                raise PermissionError("An assigned league team is required.")
            player_ids = [str(value) for value in arguments["player_ids"]]
            service.set_queue(user_id, team_id, player_ids)
            return {"player_ids": player_ids}
        if name in {"save_my_lineup", "update_my_chip"}:
            from cdl_api.contracts.team_selection import ChipUpdateRequest, LineupUpdateRequest
            from cdl_api.database import build_session_factory
            from cdl_api.repositories.postgres_team_selection import (
                PostgreSQLTeamSelectionRepository,
            )
            from cdl_api.services.team_selection import ChipService, TeamSelectionService
            from cdl_api.staging_draft_seed import UnassignedManagerContextError

            self._require_actor_scoped_storage()
            try:
                repository = PostgreSQLTeamSelectionRepository(
                    build_session_factory(self.settings), user_id=user_id
                )
            except UnassignedManagerContextError as exc:
                raise PermissionError("An assigned league manager is required.") from exc
            args = {key: value for key, value in arguments.items() if key != "idempotency_key"}
            if name == "save_my_lineup":
                return TeamSelectionService(repository).update_lineup(
                    LineupUpdateRequest.model_validate(args)
                )
            chip_id = str(args.pop("chip_id"))
            return ChipService(repository).update_chip(
                chip_id, ChipUpdateRequest.model_validate(args)
            )
        if name in {
            "propose_trade",
            "apply_squad_changes",
            "respond_to_trade",
            "approve_pending_request",
            "manage_player_interest",
        }:
            from cdl_api.contracts.squad import (
                InterestCreateRequest,
                SquadChangesRequest,
                TradeApprovalDecision,
                TradeCreateRequest,
                TradeStatus,
            )

            self._require_actor_scoped_storage()
            squad = self._squad_service(user_id)
            args = {key: value for key, value in arguments.items() if key != "idempotency_key"}
            if name == "propose_trade":
                return squad.create_trade(TradeCreateRequest.model_validate(args))
            if name == "apply_squad_changes":
                return squad.apply_changes(SquadChangesRequest.model_validate(args))
            if name == "respond_to_trade":
                return squad.update_trade(
                    str(args["trade_id"]), TradeStatus(args["status"]), user_id
                )
            if name == "manage_player_interest":
                if args["action"] == "create":
                    return squad.create_interest(InterestCreateRequest.model_validate(args))
                if args["action"] == "remove":
                    interest_id = str(args.get("interest_id", ""))
                    if not interest_id:
                        raise ValueError("interest_id is required to remove a player interest.")
                    if not squad.delete_interest(interest_id):
                        raise ValueError("Player interest not found for this manager.")
                    return {"deleted_interest_id": interest_id}
                raise ValueError("Unsupported player-interest action.")
            if args["request_type"] == "trade":
                return squad.approve_trade(
                    str(args["request_id"]),
                    TradeApprovalDecision(args["decision"]),
                    user_id,
                    args.get("note"),
                )
            return self._loan_service(user_id).approve(
                str(args["request_id"]),
                TradeApprovalDecision(args["decision"]),
                args.get("note"),
            )
        if name in {"request_player_loan", "decide_loan_request"}:
            from cdl_api.contracts.loans import LoanCreateRequest, LoanStatus

            self._require_actor_scoped_storage()
            service = self._loan_service(user_id)
            args = {key: value for key, value in arguments.items() if key != "idempotency_key"}
            if name == "request_player_loan":
                return service.create(LoanCreateRequest.model_validate(args))
            return service.decide(str(args["loan_id"]), LoanStatus(args["status"]))
        if name in {"submit_free_agency_preferences", "manage_free_agency_draw"}:
            from cdl_api.contracts.free_agency import (
                FreeAgencyDrawCreateRequest,
                FreeAgencyPreferencesRequest,
            )

            self._require_actor_scoped_storage()
            service = self._free_agency_service(user_id)
            args = {key: value for key, value in arguments.items() if key != "idempotency_key"}
            if name == "submit_free_agency_preferences":
                return service.submit_preferences(
                    str(args["draw_id"]), FreeAgencyPreferencesRequest.model_validate(args)
                )
            action = str(args["action"])
            if action == "create":
                return service.create_draw(FreeAgencyDrawCreateRequest.model_validate(args))
            draw_id = str(args["draw_id"])
            if action == "open":
                return service.open_draw(draw_id)
            if action == "lock":
                return service.lock_draw(draw_id)
            if action == "process":
                return service.process_draw(draw_id)
            raise ValueError("Unsupported free-agency draw action.")
        if name == "manage_league_invite":
            self._require_actor_scoped_storage()
            user = repositories.users.get_by_id(user_id)
            access = repositories.league_memberships.access_for_user(user_id)
            email = str(getattr(user, "email", "")).lower()
            if access is None or (
                access.role.lower() not in {"commissioner", "admin"}
                and email not in self.settings.commissioner_email_set
            ):
                raise PermissionError("Commissioner permission is required.")
            if arguments["action"] == "create":
                return repositories.league_memberships.create_invite(
                    user_id, str(arguments["team_id"])
                )
            if arguments["action"] == "revoke":
                invite_id = str(arguments["invite_id"])
                if not repositories.league_memberships.revoke_invite(invite_id):
                    raise ValueError("Pending league invite not found.")
                return {"revoked": True}
            raise ValueError("Unsupported league-invite action.")
        if name in {"make_live_draft_pick", "control_live_draft_room"}:
            self._require_actor_scoped_storage()
            from cdl_api.database import build_session_factory
            from cdl_api.services.live_draft import LiveDraftService

            service = LiveDraftService(build_session_factory(self.settings))
            membership = service.membership(user_id)
            if membership is None:
                raise PermissionError("Current league membership is required.")
            args = {key: value for key, value in arguments.items() if key != "idempotency_key"}
            if name == "make_live_draft_pick":
                team_id = membership.get("team_id")
                if not team_id:
                    raise PermissionError("An assigned league team is required.")
                return service.make_pick(
                    actor_id=user_id,
                    team_id=team_id,
                    player_id=str(args["player_id"]),
                    idempotency_key=str(arguments["idempotency_key"]),
                )
            if membership.get("role") not in {"commissioner", "admin"}:
                raise PermissionError("Commissioner permission is required.")
            action = str(args["action"])
            if action == "create":
                return {
                    "id": service.create(
                        actor_id=user_id,
                        mode=str(args["mode"]),
                        rounds=int(args.get("rounds", 20)),
                        clock_enabled=bool(args.get("clock_enabled", False)),
                        pick_seconds=args.get("pick_seconds"),
                        manual_team_order=args.get("manual_team_order"),
                    ),
                    "status": "setup",
                }
            service.control(user_id, action)
            return {"status": action}
        if name == "query_dashboard_widget":
            return self._query_dashboard_widget(arguments)
        raise NotImplementedError(
            f"The existing service adapter for '{tool.name}' is not installed yet."
        )

    def _manager_context(self, user_id: str) -> tuple[Any, Any, Any]:
        """Build user-bound squad and selection services without session-cookie dependencies."""
        repositories = build_repositories(self.settings)
        if self.settings.repository_mode == "postgres":
            from cdl_api.database import build_session_factory
            from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
            from cdl_api.repositories.postgres_team_selection import (
                PostgreSQLTeamSelectionRepository,
            )
            from cdl_api.staging_draft_seed import UnassignedManagerContextError

            factory = build_session_factory(self.settings)
            try:
                squad_repo = PostgreSQLSquadRepository(factory, user_id=user_id)
                selection_repo = PostgreSQLTeamSelectionRepository(factory, user_id=user_id)
            except UnassignedManagerContextError as exc:
                raise PermissionError("An assigned league manager is required.") from exc
        else:
            squad_repo, selection_repo = repositories.squad, repositories.team_selection
        from cdl_api.services.squad import SquadManagementService
        from cdl_api.services.team_selection import TeamSelectionService

        return (
            SquadManagementService(squad_repo),
            TeamSelectionService(selection_repo),
            repositories,
        )

    def _require_actor_scoped_storage(self) -> None:
        if self.settings.repository_mode != "postgres":
            raise NotImplementedError(
                "AI consequential tools require actor-scoped PostgreSQL storage."
            )

    def _squad_service(self, user_id: str) -> Any:
        return self._manager_context(user_id)[0]

    def _loan_service(self, user_id: str) -> Any:
        if self.settings.repository_mode != "postgres":
            raise NotImplementedError("Loan reads require PostgreSQL storage.")
        from cdl_api.database import build_session_factory
        from cdl_api.repositories.loans import PostgreSQLLoanRepository
        from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
        from cdl_api.services.loans import LoanService
        from cdl_api.staging_draft_seed import UnassignedManagerContextError

        factory = build_session_factory(self.settings)
        try:
            squad = PostgreSQLSquadRepository(factory, user_id=user_id)
        except UnassignedManagerContextError as exc:
            raise PermissionError("An assigned league manager is required.") from exc
        return LoanService(
            PostgreSQLLoanRepository(
                factory,
                user_id=user_id,
                manager_id=squad._manager_id,
                team_id=squad.manager_team.id,
            )
        )

    def _free_agency_service(self, user_id: str) -> Any:
        if self.settings.repository_mode != "postgres":
            raise NotImplementedError("Free-agency reads require PostgreSQL storage.")
        from cdl_api.database import build_session_factory
        from cdl_api.repositories.free_agency_draws import PostgreSQLFreeAgencyDrawRepository
        from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
        from cdl_api.services.free_agency_draws import FreeAgencyDrawService
        from cdl_api.staging_draft_seed import UnassignedManagerContextError

        factory = build_session_factory(self.settings)
        try:
            squad = PostgreSQLSquadRepository(factory, user_id=user_id)
        except UnassignedManagerContextError as exc:
            raise PermissionError("An assigned league manager is required.") from exc
        return FreeAgencyDrawService(
            PostgreSQLFreeAgencyDrawRepository(
                factory,
                user_id=user_id,
                manager_id=squad._manager_id,
                team_id=squad.manager_team.id,
            )
        )

    def _fpl_service(self) -> Any:
        if self.settings.repository_mode != "postgres":
            raise NotImplementedError("FPL cache reads require PostgreSQL storage.")
        from cdl_api.database import build_session_factory
        from cdl_api.fpl_client import FplApiClient
        from cdl_api.repositories.postgres_fpl_data import PostgreSQLFplDataRepository
        from cdl_api.services.fpl_data_service import FplDataService

        factory = build_session_factory(self.settings)
        return FplDataService(
            FplApiClient(
                base_url=self.settings.fpl_api_base_url,
                timeout_seconds=self.settings.fpl_api_timeout_seconds,
            ),
            PostgreSQLFplDataRepository(factory),
        )

    def _query_dashboard_widget(self, arguments: dict[str, Any]) -> Any:
        from cdl_api.contracts.dashboard import DashboardFilterValue, WidgetQueryRequest
        from cdl_api.database import build_session_factory
        from cdl_api.repositories.dashboard_repository import DashboardRepository
        from cdl_api.repositories.postgres_dashboard_config import (
            PostgreSQLDashboardConfigRepository,
        )
        from cdl_api.repositories.postgres_dashboard_snapshots import (
            PostgreSQLDashboardSnapshotRepository,
        )
        from cdl_api.services.dashboard_service import WidgetQueryService

        if self.settings.repository_mode == "postgres":
            factory = build_session_factory(self.settings)
            config_repo = PostgreSQLDashboardConfigRepository(factory)
            query_repo = PostgreSQLDashboardSnapshotRepository(factory)
        else:
            config_repo = query_repo = DashboardRepository()
        if self.settings.repository_mode == "postgres":
            widget = config_repo.get_widget(str(arguments["widget_id"]))
        else:
            from cdl_api.services.dashboard_service import DashboardService

            widget = DashboardService(config_repo).get_widget(str(arguments["widget_id"]))
        if widget is None:
            return None
        request = WidgetQueryRequest(
            filters=[
                DashboardFilterValue.model_validate(item) for item in arguments.get("filters", [])
            ],
            drilldown_dimension_id=arguments.get("drilldown_dimension_id"),
            limit=arguments.get("limit", 10),
        )
        return WidgetQueryService(query_repo).query_widget(widget, request)


class AIExecutionGateway:
    """Enforce current league role, 60-minute grants, approvals and audit at invocation."""

    def __init__(
        self,
        settings: Settings,
        policy: AIExecutionPolicy,
        dispatcher: ToolDispatcher | None = None,
    ) -> None:
        self.settings = settings
        self.policy = policy
        self.dispatcher = dispatcher or ExistingServiceDispatcher(settings)

    def _authorize_role(self, tool: ToolDefinition, user_id: str) -> None:
        if tool.required_role is ToolRole.AUTHENTICATED:
            return
        repositories = build_repositories(self.settings)
        access = repositories.league_memberships.access_for_user(user_id)
        if access is None:
            raise PermissionError("Current league membership is required for this tool.")
        role = access.role.lower()
        if tool.required_role is ToolRole.LEAGUE_MEMBER:
            return
        if tool.required_role is ToolRole.MANAGER:
            if not access.team_id or role not in {
                "manager",
                "commissioner",
                "vice_commissioner",
                "admin",
            }:
                raise PermissionError("An assigned league manager role is required.")
            return
        if tool.required_role is ToolRole.ELIGIBLE_APPROVER:
            if role not in {"manager", "commissioner", "vice_commissioner", "admin"}:
                raise PermissionError("An eligible league approver role is required.")
            return
        if tool.required_role is ToolRole.COMMISSIONER:
            user = repositories.users.get_by_id(user_id)
            email = str(getattr(user, "email", "")).lower()
            if (
                role not in {"commissioner", "admin"}
                and email not in self.settings.commissioner_email_set
            ):
                raise PermissionError("Commissioner permission is required.")

    def execute(
        self,
        tool: ToolDefinition,
        arguments: dict[str, Any],
        *,
        user_id: str,
        connection_id: str | None,
    ) -> Any:
        connection = connection_id or f"browser:{user_id}"
        try:
            self._authorize_role(tool, user_id)
        except Exception:
            self.policy.record_activity(
                user_id=user_id,
                connection_id=connection,
                tool_name=tool.name,
                risk=tool.risk.value,
                outcome="permission_denied",
                arguments=arguments,
            )
            raise
        proposal_id: str | None = None
        if tool.risk is ToolRisk.CONSEQUENTIAL:
            key = str(arguments.get("idempotency_key", ""))
            if not key:
                self.policy.record_activity(
                    user_id=user_id,
                    connection_id=connection,
                    tool_name=tool.name,
                    risk=tool.risk.value,
                    outcome="invalid_request",
                    arguments=arguments,
                )
                raise ValueError("A stable idempotency key is required for this action.")
            if self.policy.active_grant(user_id, connection) is None:
                outcome = {"status": "execution_grant_required"}
                self.policy.record_activity(
                    user_id=user_id,
                    connection_id=connection,
                    tool_name=tool.name,
                    risk=tool.risk.value,
                    outcome="blocked_grant",
                    arguments=arguments,
                )
                return outcome
            try:
                state_version = self.dispatcher.state_version(tool, arguments, user_id=user_id)
                decision = self.policy.prepare_consequential(
                    user_id=user_id,
                    connection_id=connection,
                    tool_name=tool.name,
                    arguments=arguments,
                    idempotency_key=key,
                    state_version=state_version,
                    approval_base_url=self.settings.oauth_issuer_url.rstrip("/")
                    + self.settings.api_prefix,
                )
            except Exception:
                self.policy.record_activity(
                    user_id=user_id,
                    connection_id=connection,
                    tool_name=tool.name,
                    risk=tool.risk.value,
                    outcome="preflight_error",
                    arguments=arguments,
                )
                raise
            status = decision["status"]
            if status != "approved":
                self.policy.record_activity(
                    user_id=user_id,
                    connection_id=connection,
                    tool_name=tool.name,
                    risk=tool.risk.value,
                    outcome=str(status),
                    arguments=arguments,
                )
                return decision
            proposal_id = str(decision["proposal_id"])
            if self.policy.active_grant(user_id, connection) is None:
                self.policy.record_activity(
                    user_id=user_id,
                    connection_id=connection,
                    tool_name=tool.name,
                    risk=tool.risk.value,
                    outcome="blocked_expired_grant",
                    arguments=arguments,
                )
                return {"status": "execution_grant_expired"}
        try:
            result = self.dispatcher.execute(tool, arguments, user_id=user_id)
        except Exception as exc:
            if proposal_id:
                self.policy.finish_proposal(
                    proposal_id, {"error": type(exc).__name__}, status="failed"
                )
            self.policy.record_activity(
                user_id=user_id,
                connection_id=connection,
                tool_name=tool.name,
                risk=tool.risk.value,
                outcome="error",
                arguments=arguments,
            )
            raise
        if proposal_id:
            self.policy.finish_proposal(proposal_id, jsonable_encoder(result))
        self.policy.record_activity(
            user_id=user_id,
            connection_id=connection,
            tool_name=tool.name,
            risk=tool.risk.value,
            outcome="success",
            arguments=arguments,
        )
        return result
