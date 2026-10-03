"""Squad repositories for feature development and production-backed persistence."""

from copy import deepcopy
from datetime import UTC, datetime
from typing import Protocol
from uuid import uuid4

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.squad import (
    InterestResponse,
    PlayerDetail,
    PlayerMetric,
    PlayerOwnershipStatus,
    PlayerPosition,
    ScoutingFilters,
    TradeApprovalDecision,
    TradeApprovalStatus,
    TradeAuditEventResponse,
    TradeProposal,
    TradeStatus,
)


class SquadRepository(Protocol):
    manager_team: TeamSummary
    rival_team: TeamSummary
    gameweek: GameweekSummary

    def list_squad_players(self) -> list[PlayerDetail]: ...

    def list_players(self, filters: ScoutingFilters) -> list[PlayerDetail]: ...

    def get_player(self, player_id: str) -> PlayerDetail | None: ...

    def list_interests(self) -> list[InterestResponse]: ...

    def find_active_interest_by_player(self, player_id: str) -> InterestResponse | None: ...

    def save_interest(self, interest: InterestResponse) -> InterestResponse: ...

    def delete_interest(self, interest_id: str) -> bool: ...

    def list_trades(self) -> list[TradeProposal]: ...

    def get_trade(self, trade_id: str) -> TradeProposal | None: ...

    def list_pending_trade_approvals(self, actor_user_id: str) -> list[TradeProposal]: ...

    def trade_audit(
        self, trade_id: str, actor_user_id: str
    ) -> list[TradeAuditEventResponse] | None: ...

    def save_trade(self, trade: TradeProposal) -> TradeProposal: ...

    def manager_id_for_team(self, team_id: str) -> str | None: ...

    def update_trade_status(
        self, trade_id: str, status: TradeStatus, actor_manager_id: str
    ) -> TradeProposal | None: ...

    def required_trade_approver_role(
        self, offered_by_team_id: str, offered_to_team_id: str
    ) -> str: ...

    def approve_trade(
        self, trade_id: str, actor_user_id: str, decision: TradeApprovalDecision, note: str | None
    ) -> TradeProposal | None: ...

    def team_for_id(self, team_id: str) -> TeamSummary | None: ...

    def list_available_rights(self) -> list[PlayerDetail]: ...

    def apply_squad_changes(
        self, add_player_ids: list[str], remove_player_ids: list[str]
    ) -> None: ...


class InMemorySquadRepository:
    def __init__(self) -> None:
        self.manager_team = TeamSummary(id="team-castle", name="Castle FC")
        self.rival_team = TeamSummary(id="team-rival", name="Rival Town")
        self.gameweek = GameweekSummary(id="gw-1", name="Gameweek 1", number=1)
        arsenal = TeamSummary(id="epl-ars", name="Arsenal")
        city = TeamSummary(id="epl-mci", name="Manchester City")
        self._players = [
            self._make(
                "player-1",
                "Alex Keeper",
                PlayerPosition.GOALKEEPER,
                arsenal,
                self.manager_team,
                PlayerOwnershipStatus.OWNED,
                42,
                5.4,
                5.0,
            ),
            self._make(
                "player-2",
                "Ben Defender",
                PlayerPosition.DEFENDER,
                city,
                self.manager_team,
                PlayerOwnershipStatus.OWNED,
                55,
                6.1,
                6.0,
            ),
            self._make(
                "player-3",
                "Casey Midfielder",
                PlayerPosition.MIDFIELDER,
                arsenal,
                None,
                PlayerOwnershipStatus.AVAILABLE,
                61,
                7.2,
                7.5,
            ),
            self._make(
                "player-4",
                "Riley Forward",
                PlayerPosition.FORWARD,
                city,
                self.rival_team,
                PlayerOwnershipStatus.TRADE_TARGET,
                70,
                8.0,
                9.0,
            ),
        ]
        self._interests: dict[str, InterestResponse] = {}
        self._trades: dict[str, TradeProposal] = {}
        self._trade_audit_events: dict[str, list[TradeAuditEventResponse]] = {}

    def _make(
        self,
        player_id: str,
        name: str,
        position: PlayerPosition,
        epl_team: TeamSummary,
        draft_team: TeamSummary | None,
        status: PlayerOwnershipStatus,
        points: int,
        form: float,
        value: float,
    ) -> PlayerDetail:
        return PlayerDetail(
            id=player_id,
            display_name=name,
            position=position,
            team=epl_team,
            epl_team=epl_team,
            draft_team=draft_team,
            status=status,
            points=points,
            form=form,
            value=value,
        )

    def list_squad_players(self) -> list[PlayerDetail]:
        return [deepcopy(player) for player in self._players if player.draft_team]

    def list_players(self, filters: ScoutingFilters) -> list[PlayerDetail]:
        players = deepcopy(self._players)
        if filters.position is not None:
            players = [player for player in players if player.position == filters.position]
        if filters.query:
            query = filters.query.lower()
            players = [player for player in players if query in player.display_name.lower()]
        metric = "points"
        if filters.metric != PlayerMetric.TOTAL_POINTS:
            metric = filters.metric.value
        return sorted(players, key=lambda player: getattr(player, metric), reverse=True)

    def get_player(self, player_id: str) -> PlayerDetail | None:
        for player in self._players:
            if player.id == player_id:
                return deepcopy(player)
        return None

    def list_interests(self) -> list[InterestResponse]:
        return [deepcopy(interest) for interest in self._interests.values()]

    def find_active_interest_by_player(self, player_id: str) -> InterestResponse | None:
        for interest in self._interests.values():
            if interest.player.id == player_id:
                return deepcopy(interest)
        return None

    def save_interest(self, interest: InterestResponse) -> InterestResponse:
        self._interests[interest.id] = deepcopy(interest)
        return deepcopy(interest)

    def delete_interest(self, interest_id: str) -> bool:
        return self._interests.pop(interest_id, None) is not None

    def list_trades(self) -> list[TradeProposal]:
        return [deepcopy(trade) for trade in self._trades.values()]

    def get_trade(self, trade_id: str) -> TradeProposal | None:
        trade = self._trades.get(trade_id)
        return None if trade is None else deepcopy(trade)

    def list_pending_trade_approvals(self, actor_user_id: str) -> list[TradeProposal]:
        if actor_user_id != "commissioner":
            return []
        return [
            deepcopy(trade)
            for trade in self._trades.values()
            if trade.status == TradeStatus.ACCEPTED
            and trade.approval_status == TradeApprovalStatus.PENDING
        ]

    def trade_audit(
        self, trade_id: str, actor_user_id: str
    ) -> list[TradeAuditEventResponse] | None:
        trade = self._trades.get(trade_id)
        if trade is None:
            return None
        required_role = trade.required_approver_role or "commissioner"
        approver_id = (
            "vice_commissioner" if required_role == "vice_commissioner" else "commissioner"
        )
        if actor_user_id != approver_id and actor_user_id not in {
            self.manager_id_for_team(trade.offered_by.id),
            self.manager_id_for_team(trade.offered_to.id),
        }:
            return None
        return deepcopy(self._trade_audit_events.get(trade_id, []))

    def save_trade(self, trade: TradeProposal) -> TradeProposal:
        self._trades[trade.id] = deepcopy(trade)
        self._trade_audit_events.setdefault(trade.id, []).append(
            TradeAuditEventResponse(
                id=f"audit-{uuid4().hex[:12]}",
                subject_type="trade",
                subject_id=trade.id,
                action="trade_proposed",
                actor_manager_id=self.manager_id_for_team(trade.offered_by.id),
                created_at=datetime.now(UTC),
            )
        )
        return deepcopy(trade)

    def manager_id_for_team(self, team_id: str) -> str | None:
        return {
            self.manager_team.id: "manager-1",
            self.rival_team.id: "manager-rival",
        }.get(team_id)

    def team_for_id(self, team_id: str) -> TeamSummary | None:
        if team_id == self.manager_team.id:
            return deepcopy(self.manager_team)
        if team_id == self.rival_team.id:
            return deepcopy(self.rival_team)
        return None

    def update_trade_status(
        self, trade_id: str, status: TradeStatus, actor_manager_id: str
    ) -> TradeProposal | None:
        trade = self._trades.get(trade_id)
        if trade is None:
            return None
        trade.status = status
        if status == TradeStatus.ACCEPTED:
            trade.approval_status = TradeApprovalStatus.PENDING
        self._trade_audit_events.setdefault(trade_id, []).append(
            TradeAuditEventResponse(
                id=f"audit-{uuid4().hex[:12]}",
                subject_type="trade",
                subject_id=trade_id,
                action={
                    TradeStatus.ACCEPTED: "trade_agreed",
                    TradeStatus.REJECTED: "trade_rejected_by_party",
                    TradeStatus.CANCELLED: "trade_cancelled",
                }[status],
                actor_manager_id=actor_manager_id,
                created_at=datetime.now(UTC),
            )
        )
        return deepcopy(trade)

    def required_trade_approver_role(self, offered_by_team_id: str, offered_to_team_id: str) -> str:
        return "commissioner"

    def approve_trade(
        self, trade_id: str, actor_user_id: str, decision: TradeApprovalDecision, note: str | None
    ) -> TradeProposal | None:
        trade = self._trades.get(trade_id)
        if trade is None:
            return None
        if trade.status != TradeStatus.ACCEPTED:
            raise ValueError("Trade is not waiting for approval.")
        if actor_user_id in {"manager-1", "manager-rival"}:
            raise ValueError("A trade participant cannot approve their own trade.")
        if trade.required_approver_role == "commissioner" and actor_user_id != "commissioner":
            raise ValueError("Trade requires a commissioner approver.")
        if trade.approval_status == TradeApprovalStatus.APPROVED:
            return deepcopy(trade)
        trade.approval_status = (
            TradeApprovalStatus.APPROVED
            if decision == TradeApprovalDecision.APPROVED
            else TradeApprovalStatus.REJECTED
        )
        if decision == TradeApprovalDecision.APPROVED:
            trade.executed_at = datetime.now(UTC)
            for asset in trade.assets:
                player = next((item for item in self._players if item.id == asset.player.id), None)
                if player is not None:
                    player.draft_team = asset.to_team
                    player.status = PlayerOwnershipStatus.OWNED
        trade.approved_by = actor_user_id
        self._trade_audit_events.setdefault(trade_id, []).append(
            TradeAuditEventResponse(
                id=f"audit-{uuid4().hex[:12]}",
                subject_type="trade",
                subject_id=trade_id,
                action=(
                    "trade_executed"
                    if decision == TradeApprovalDecision.APPROVED
                    else "trade_rejected"
                ),
                actor_manager_id=actor_user_id,
                created_at=datetime.now(UTC),
                metadata={
                    "note": note or "",
                    "required_approver_role": trade.required_approver_role or "commissioner",
                },
            )
        )
        return deepcopy(trade)

    def list_available_rights(self) -> list[PlayerDetail]:
        return []

    def apply_squad_changes(self, add_player_ids: list[str], remove_player_ids: list[str]) -> None:
        if add_player_ids or remove_player_ids:
            raise ValueError("Squad changes are unavailable in the in-memory repository.")
