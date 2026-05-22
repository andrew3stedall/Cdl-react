import pytest

from cdl_api.contracts.squad import (
    InterestCreateRequest,
    PlayerPosition,
    ScoutingFilters,
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
