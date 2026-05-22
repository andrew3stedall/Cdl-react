"""Squad management service layer."""

from uuid import uuid4

from cdl_api.contracts.common import RuleReference, ValidationIssue
from cdl_api.contracts.squad import (
    InterestCreateRequest,
    InterestResponse,
    PlayerDetail,
    PlayerOwnershipStatus,
    PlayerPosition,
    ScoutingFilters,
    ScoutingPlayersResponse,
    SquadSummaryResponse,
    TradeAsset,
    TradeCreateRequest,
    TradeProposal,
    TradeStatus,
)
from cdl_api.repositories.squad import InMemorySquadRepository

SQUAD_SIZE_RULE = "squad-size"
TRADE_WINDOW_RULE = RuleReference(
    rule_id="trade-window",
    label="Trade Window",
    href="/rules#trade-window",
)


class SquadValidationError(ValueError):
    def __init__(self, message: str, issues: list[ValidationIssue]) -> None:
        super().__init__(message)
        self.issues = issues


class SquadManagementService:
    def __init__(self, repository: InMemorySquadRepository) -> None:
        self._repository = repository
        self._interests: dict[str, InterestResponse] = {}
        self._trades: dict[str, TradeProposal] = {}

    def get_summary(self) -> SquadSummaryResponse:
        players = self._repository.list_squad_players()
        totals = {position: 0 for position in PlayerPosition}
        for player in players:
            if player.position is not None:
                totals[PlayerPosition(player.position)] += 1
        return SquadSummaryResponse(
            manager_team=self._repository.manager_team,
            gameweek=self._repository.gameweek,
            players=players,
            total_players=len(players),
            positional_totals=totals,
            squad_value=round(sum(player.value for player in players), 1),
        )

    def scout_players(self, filters: ScoutingFilters) -> ScoutingPlayersResponse:
        return ScoutingPlayersResponse(
            filters=filters,
            players=self._repository.list_players(filters),
        )

    def create_interest(self, request: InterestCreateRequest) -> InterestResponse:
        player = self._require_player(request.player_id)
        if player.status == PlayerOwnershipStatus.OWNED:
            issue = ValidationIssue(
                field="player_id",
                message="Player is already owned.",
                rule_reference=SQUAD_SIZE_RULE,
            )
            raise SquadValidationError("Player already in squad.", [issue])
        player.status = PlayerOwnershipStatus.INTERESTED
        interest = InterestResponse(
            id=f"interest-{uuid4().hex[:8]}",
            player=player,
            gameweek=self._repository.gameweek,
            note=request.note,
        )
        self._interests[interest.id] = interest
        return interest

    def delete_interest(self, interest_id: str) -> bool:
        return self._interests.pop(interest_id, None) is not None

    def list_trades(self) -> list[TradeProposal]:
        return list(self._trades.values())

    def create_trade(self, request: TradeCreateRequest) -> TradeProposal:
        sent_players = [
            self._require_player(player_id) for player_id in request.offered_player_ids
        ]
        wanted_players = [
            self._require_player(player_id) for player_id in request.requested_player_ids
        ]
        for player in sent_players:
            if player.draft_team != self._repository.manager_team:
                issue = ValidationIssue(
                    field="offered_player_ids",
                    message="Player is not in your squad.",
                    rule_reference="trade-window",
                )
                raise SquadValidationError("Invalid trade asset.", [issue])
        assets = [
            *[
                TradeAsset(
                    player=player,
                    from_team=self._repository.manager_team,
                    to_team=self._repository.rival_team,
                )
                for player in sent_players
            ],
            *[
                TradeAsset(
                    player=player,
                    from_team=self._repository.rival_team,
                    to_team=self._repository.manager_team,
                )
                for player in wanted_players
            ],
        ]
        trade = TradeProposal(
            id=f"trade-{uuid4().hex[:8]}",
            status=TradeStatus.PROPOSED,
            offered_by=self._repository.manager_team,
            offered_to=self._repository.rival_team,
            gameweek=self._repository.gameweek,
            assets=assets,
            rule_references=[TRADE_WINDOW_RULE],
        )
        self._trades[trade.id] = trade
        return trade

    def update_trade(self, trade_id: str, status: TradeStatus) -> TradeProposal | None:
        trade = self._trades.get(trade_id)
        if trade is None:
            return None
        trade.status = status
        return trade

    def _require_player(self, player_id: str) -> PlayerDetail:
        player = self._repository.get_player(player_id)
        if player is None:
            issue = ValidationIssue(field="player_id", message="Unknown player.")
            raise SquadValidationError("Player could not be found.", [issue])
        return player
