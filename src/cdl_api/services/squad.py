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
    SquadChangesRequest,
    SquadChangesResponse,
    SquadNotification,
    SquadNotificationsResponse,
    SquadSummaryResponse,
    TradeAsset,
    TradeCreateRequest,
    TradeProposal,
    TradeStatus,
)
from cdl_api.repositories.squad import SquadRepository

SQUAD_SIZE_RULE = "squad-size"
SQUAD_POSITION_LIMITS: dict[PlayerPosition, tuple[int, int]] = {
    PlayerPosition.GOALKEEPER: (2, 3),
    PlayerPosition.DEFENDER: (4, 10),
    PlayerPosition.MIDFIELDER: (5, 10),
    PlayerPosition.FORWARD: (2, 4),
}
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
    def __init__(self, repository: SquadRepository) -> None:
        self._repository = repository

    def get_summary(self) -> SquadSummaryResponse:
        players = []
        for player in self._repository.list_squad_players():
            if player.draft_team == self._repository.manager_team:
                players.append(player)
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
        players = self._repository.list_players(filters)
        return ScoutingPlayersResponse(filters=filters, players=players)

    def get_changes(self) -> SquadChangesResponse:
        return SquadChangesResponse(available_to_add=self._repository.list_available_rights())

    def apply_changes(self, request: SquadChangesRequest) -> SquadSummaryResponse:
        additions = list(dict.fromkeys(request.add_player_ids))
        removals = list(dict.fromkeys(request.remove_player_ids))
        if len(additions) != len(request.add_player_ids):
            raise SquadValidationError(
                "A player can only be added once.",
                [
                    ValidationIssue(
                        field="add_player_ids", message="Duplicate player IDs are not allowed."
                    )
                ],
            )
        if len(removals) != len(request.remove_player_ids):
            raise SquadValidationError(
                "A player can only be removed once.",
                [
                    ValidationIssue(
                        field="remove_player_ids", message="Duplicate player IDs are not allowed."
                    )
                ],
            )
        if len(additions) != len(removals):
            raise SquadValidationError(
                "Squad changes must keep the squad at a fixed size.",
                [
                    ValidationIssue(
                        field="remove_player_ids",
                        message="Add one player for every player removed.",
                        rule_reference=SQUAD_SIZE_RULE,
                    )
                ],
            )

        available_ids = {player.id for player in self._repository.list_available_rights()}
        for player_id in additions:
            if player_id not in available_ids:
                raise SquadValidationError(
                    "Player right is not active.",
                    [
                        ValidationIssue(
                            field="add_player_ids", message=f"No active right for {player_id}."
                        )
                    ],
                )
        owned_players = {player.id: player for player in self._repository.list_squad_players()}
        owned_ids = set(owned_players)
        for player_id in removals:
            if player_id not in owned_ids:
                raise SquadValidationError(
                    "Player is not in the active squad.",
                    [
                        ValidationIssue(
                            field="remove_player_ids", message=f"Unknown squad player {player_id}."
                        )
                    ],
                )

        available_players = {
            player.id: player
            for player in self._repository.list_available_rights()
            if player.id in additions
        }
        projected_players = [
            player for player_id, player in owned_players.items() if player_id not in removals
        ] + list(available_players.values())
        projected_counts = {position: 0 for position in PlayerPosition}
        for player in projected_players:
            if player.position is not None:
                projected_counts[PlayerPosition(player.position)] += 1
        for position, (minimum, maximum) in SQUAD_POSITION_LIMITS.items():
            count = projected_counts[position]
            if not minimum <= count <= maximum:
                raise SquadValidationError(
                    "Squad position limits would be exceeded.",
                    [
                        ValidationIssue(
                            field="add_player_ids",
                            message=(
                                f"{position} must stay between {minimum} and {maximum} "
                                f"players (would be {count})."
                            ),
                            rule_reference=SQUAD_SIZE_RULE,
                        )
                    ],
                )

        try:
            self._repository.apply_squad_changes(additions, removals)
        except ValueError as exc:
            raise SquadValidationError(
                str(exc),
                [ValidationIssue(field="changes", message=str(exc))],
            ) from exc
        return self.get_summary()

    def notifications(self) -> SquadNotificationsResponse:
        notifications: list[SquadNotification] = []
        proposed_trades = [
            trade
            for trade in self._repository.list_trades()
            if trade.status is TradeStatus.PROPOSED
        ]
        if proposed_trades:
            count = len(proposed_trades)
            notifications.append(
                SquadNotification(
                    id="proposed-trades",
                    title="Trade proposals need review",
                    message=(
                        f"{count} proposed trade{'s' if count != 1 else ''} is waiting for you."
                    ),
                    action_href="/scouting",
                    kind="trade",
                )
            )
        at_risk = [
            player
            for player in self._repository.list_squad_players()
            if player.chance_of_playing_next_round is not None
            and player.chance_of_playing_next_round < 75
        ]
        if at_risk:
            notifications.append(
                SquadNotification(
                    id="availability-risk",
                    title="Availability needs attention",
                    message=(
                        f"{len(at_risk)} squad player{'s' if len(at_risk) != 1 else ''} "
                        "has a reduced FPL chance of playing."
                    ),
                    action_href="/squad",
                    kind="availability",
                )
            )
        return SquadNotificationsResponse(
            notifications=notifications,
            proposed_trade_count=len(proposed_trades),
        )

    def list_interests(self) -> list[InterestResponse]:
        return self._repository.list_interests()

    def create_interest(self, request: InterestCreateRequest) -> InterestResponse:
        player = self._require_player(request.player_id)
        if player.status == PlayerOwnershipStatus.OWNED:
            issue = ValidationIssue(
                field="player_id",
                message="Player is already owned.",
                rule_reference=SQUAD_SIZE_RULE,
            )
            raise SquadValidationError("Player already in squad.", [issue])
        existing_interest = self._repository.find_active_interest_by_player(request.player_id)
        if existing_interest is not None:
            issue = ValidationIssue(
                field="player_id",
                message="Player is already registered as an interest.",
            )
            raise SquadValidationError("Interest already exists.", [issue])
        player.status = PlayerOwnershipStatus.INTERESTED
        interest = InterestResponse(
            id=f"interest-{uuid4().hex[:8]}",
            player=player,
            gameweek=self._repository.gameweek,
            note=request.note,
        )
        return self._repository.save_interest(interest)

    def delete_interest(self, interest_id: str) -> bool:
        return self._repository.delete_interest(interest_id)

    def list_trades(self) -> list[TradeProposal]:
        return self._repository.list_trades()

    def create_trade(self, request: TradeCreateRequest) -> TradeProposal:
        offered_to = self._repository.team_for_id(request.offered_to_team_id)
        if offered_to is None or offered_to.id == self._repository.manager_team.id:
            raise SquadValidationError(
                "Trade target could not be found.",
                [
                    ValidationIssue(
                        field="offered_to_team_id", message="Choose another manager's team."
                    )
                ],
            )
        sent_players = [self._require_player(player_id) for player_id in request.offered_player_ids]
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
        for player in wanted_players:
            if player.draft_team != offered_to:
                issue = ValidationIssue(
                    field="requested_player_ids",
                    message="Requested player is not owned by the selected manager.",
                    rule_reference="trade-window",
                )
                raise SquadValidationError("Invalid trade asset.", [issue])
        assets = [
            TradeAsset(
                player=player,
                from_team=self._repository.manager_team,
                to_team=offered_to,
            )
            for player in sent_players
        ] + [
            TradeAsset(
                player=player,
                from_team=offered_to,
                to_team=self._repository.manager_team,
            )
            for player in wanted_players
        ]
        trade = TradeProposal(
            id=f"trade-{uuid4().hex[:8]}",
            status=TradeStatus.PROPOSED,
            offered_by=self._repository.manager_team,
            offered_to=offered_to,
            gameweek=self._repository.gameweek,
            assets=assets,
            rule_references=[TRADE_WINDOW_RULE],
        )
        return self._repository.save_trade(trade)

    def update_trade(
        self,
        trade_id: str,
        status: TradeStatus,
        actor_manager_id: str,
    ) -> TradeProposal | None:
        trade = next(
            (item for item in self._repository.list_trades() if item.id == trade_id),
            None,
        )
        if trade is None:
            return None
        if trade.status != TradeStatus.PROPOSED:
            raise SquadValidationError(
                "Trade is no longer pending.",
                [ValidationIssue(field="status", message="Trade status has already changed.")],
            )
        if status in {TradeStatus.ACCEPTED, TradeStatus.REJECTED}:
            required_manager_id = self._repository.manager_id_for_team(trade.offered_to.id)
        elif status == TradeStatus.CANCELLED:
            required_manager_id = self._repository.manager_id_for_team(trade.offered_by.id)
        else:
            raise SquadValidationError(
                "Invalid trade transition.",
                [
                    ValidationIssue(
                        field="status",
                        message="Trade must be accepted, rejected, or cancelled.",
                    )
                ],
            )
        if actor_manager_id != required_manager_id:
            raise SquadValidationError(
                "Trade transition is not authorized.",
                [
                    ValidationIssue(
                        field="status",
                        message="Manager cannot perform this transition.",
                    )
                ],
            )
        updated = self._repository.update_trade_status(trade_id, status)
        if updated is not None and updated.status != status:
            raise SquadValidationError(
                "Trade is no longer pending.",
                [
                    ValidationIssue(
                        field="status",
                        message="Trade status changed concurrently.",
                    )
                ],
            )
        return updated

    def _require_player(self, player_id: str) -> PlayerDetail:
        player = self._repository.get_player(player_id)
        if player is None:
            issue = ValidationIssue(field="player_id", message="Unknown player.")
            raise SquadValidationError("Player could not be found.", [issue])
        return player
