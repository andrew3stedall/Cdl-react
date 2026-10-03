import pytest

from cdl_api.contracts.domain import TeamSummary
from cdl_api.contracts.squad import (
    InterestCreateRequest,
    PlayerDetail,
    PlayerOwnershipStatus,
    PlayerPosition,
    ScoutingFilters,
    SquadChangesRequest,
    TradeApprovalDecision,
    TradeApprovalStatus,
    TradeCreateRequest,
    TradeStatus,
)
from cdl_api.repositories.squad import InMemorySquadRepository
from cdl_api.services.squad import SquadManagementService, SquadValidationError


def create_service() -> SquadManagementService:
    return SquadManagementService(InMemorySquadRepository())


def test_squad_summary_includes_totals_and_gameweek() -> None:
    service = create_service()

    summary = service.get_summary()

    assert summary.manager_team.id == "team-castle"
    assert summary.gameweek.number == 1
    assert summary.total_players == 2
    assert summary.positional_totals[PlayerPosition.GOALKEEPER] == 1
    assert summary.squad_value == 11.0


def test_scouting_filters_by_position_and_query() -> None:
    service = create_service()

    response = service.scout_players(
        ScoutingFilters(position=PlayerPosition.MIDFIELDER, query="casey")
    )

    assert [player.display_name for player in response.players] == ["Casey Midfielder"]


def test_interest_rejects_owned_player_with_rule_reference() -> None:
    service = create_service()

    with pytest.raises(SquadValidationError) as exc_info:
        service.create_interest(InterestCreateRequest(player_id="player-1"))

    assert exc_info.value.issues[0].rule_reference == "squad-size"


def test_trade_proposal_contains_rule_deep_link_reference() -> None:
    service = create_service()

    trade = service.create_trade(
        TradeCreateRequest(
            offered_to_team_id="team-rival",
            offered_player_ids=["player-1"],
            requested_player_ids=["player-4"],
        )
    )

    assert trade.status == TradeStatus.PROPOSED
    assert trade.rule_references[0].href == "/rules#trade-window"
    assert len(trade.assets) == 2


def test_agreed_trade_waits_for_approval_before_changing_ownership() -> None:
    repository = InMemorySquadRepository()
    service = SquadManagementService(repository)
    trade = service.create_trade(
        TradeCreateRequest(
            offered_to_team_id="team-rival",
            offered_player_ids=["player-1"],
            requested_player_ids=["player-4"],
        )
    )

    accepted = service.update_trade(trade.id, TradeStatus.ACCEPTED, "manager-rival")

    assert accepted is not None
    assert accepted.approval_status == TradeApprovalStatus.PENDING
    assert repository.get_player("player-1").draft_team.id == "team-castle"
    assert repository.get_player("player-4").draft_team.id == "team-rival"

    executed = service.approve_trade(
        trade.id, TradeApprovalDecision.APPROVED, "commissioner", "Both managers agreed."
    )

    assert executed is not None
    assert executed.approval_status == TradeApprovalStatus.APPROVED
    assert executed.executed_at is not None
    with pytest.raises(SquadValidationError, match="participant"):
        service.approve_trade(trade.id, TradeApprovalDecision.APPROVED, "manager-1")
    assert repository.get_player("player-1").draft_team.id == "team-rival"
    assert repository.get_player("player-4").draft_team.id == "team-castle"


def test_trade_participant_cannot_approve_agreed_trade() -> None:
    service = create_service()
    trade = service.create_trade(
        TradeCreateRequest(
            offered_to_team_id="team-rival",
            offered_player_ids=["player-1"],
            requested_player_ids=["player-4"],
        )
    )
    service.update_trade(trade.id, TradeStatus.ACCEPTED, "manager-rival")

    with pytest.raises(SquadValidationError, match="participant"):
        service.approve_trade(trade.id, TradeApprovalDecision.APPROVED, "manager-1")


def test_squad_change_position_validation_ignores_other_teams() -> None:
    repository = InMemorySquadRepository()
    manager = repository.manager_team
    rival = repository.rival_team
    template = repository._players[0]

    def player(player_id: str, position: PlayerPosition, team: TeamSummary | None) -> PlayerDetail:
        return template.model_copy(
            update={
                "id": player_id,
                "position": position,
                "draft_team": team,
                "status": PlayerOwnershipStatus.OWNED
                if team is not None
                else PlayerOwnershipStatus.AVAILABLE,
            }
        )

    repository._players = []
    for position, count in (
        (PlayerPosition.GOALKEEPER, 2),
        (PlayerPosition.DEFENDER, 4),
        (PlayerPosition.MIDFIELDER, 5),
        (PlayerPosition.FORWARD, 2),
    ):
        repository._players.extend(
            player(f"manager-{position.value}-{index}", position, manager) for index in range(count)
        )
    repository._players.extend(
        player(f"rival-def-{index}", PlayerPosition.DEFENDER, rival) for index in range(8)
    )
    right = player("available-defender", PlayerPosition.DEFENDER, None)
    repository.list_available_rights = lambda: [right]  # type: ignore[method-assign]
    repository.apply_squad_changes = lambda _add, _remove: None  # type: ignore[method-assign]

    summary = SquadManagementService(repository).apply_changes(
        SquadChangesRequest(
            add_player_ids=[right.id],
            remove_player_ids=["manager-DEF-0"],
        )
    )

    assert summary.total_players == 13
    assert summary.positional_totals[PlayerPosition.DEFENDER] == 4
