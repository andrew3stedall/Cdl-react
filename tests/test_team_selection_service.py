import pytest

from cdl_api.contracts.team_selection import (
    ChipStatus,
    ChipUpdateRequest,
    LineupPlayerUpdate,
    LineupSlot,
    LineupUpdateRequest,
)
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository
from cdl_api.services.team_selection import (
    ChipService,
    FixtureSummaryService,
    TeamSelectionService,
    TeamSelectionValidationError,
)


def create_repository() -> InMemoryTeamSelectionRepository:
    return InMemoryTeamSelectionRepository()


def valid_lineup_payload() -> LineupUpdateRequest:
    return LineupUpdateRequest(
        players=[
            LineupPlayerUpdate(player_id="player-1", slot=LineupSlot.STARTER, slot_order=1),
            LineupPlayerUpdate(player_id="player-2", slot=LineupSlot.STARTER, slot_order=2),
            LineupPlayerUpdate(player_id="player-3", slot=LineupSlot.STARTER, slot_order=3, is_captain=True),
            LineupPlayerUpdate(player_id="player-4", slot=LineupSlot.BENCH, slot_order=1, is_vice_captain=True),
            LineupPlayerUpdate(player_id="player-5", slot=LineupSlot.RESERVE, slot_order=1),
        ]
    )


def test_team_selection_load_includes_lineup_chips_and_gameweek() -> None:
    service = TeamSelectionService(create_repository())

    selection = service.get_team_selection()

    assert selection.manager_team.id == "team-castle"
    assert selection.gameweek.number == 1
    assert len(selection.lineup) == 5
    assert [chip.id for chip in selection.chips] == ["wildcard", "bench-boost", "triple-captain"]


def test_lineup_update_accepts_valid_payload() -> None:
    service = TeamSelectionService(create_repository())

    selection = service.update_lineup(valid_lineup_payload())

    assert selection.validation_messages == []
    assert sum(1 for player in selection.lineup if player.slot == LineupSlot.STARTER) == 3


def test_lineup_update_rejects_missing_player_and_missing_captain() -> None:
    service = TeamSelectionService(create_repository())
    payload = LineupUpdateRequest(players=valid_lineup_payload().players[:-1])

    with pytest.raises(TeamSelectionValidationError) as exc_info:
        service.update_lineup(payload)

    assert {issue.rule_reference for issue in exc_info.value.issues} >= {"lineup-validation", "captaincy"}


def test_chip_service_activates_available_chip_and_rejects_used_chip() -> None:
    repository = create_repository()
    chip_service = ChipService(repository)

    selection = chip_service.update_chip("wildcard", ChipUpdateRequest(active=True))

    assert next(chip for chip in selection.chips if chip.id == "wildcard").status == ChipStatus.ACTIVE

    with pytest.raises(TeamSelectionValidationError) as exc_info:
        chip_service.update_chip("bench-boost", ChipUpdateRequest(active=True))

    assert exc_info.value.issues[0].rule_reference == "chip-usage"


def test_chip_service_rejects_second_active_chip() -> None:
    repository = create_repository()
    chip_service = ChipService(repository)
    chip_service.update_chip("wildcard", ChipUpdateRequest(active=True))

    with pytest.raises(TeamSelectionValidationError) as exc_info:
        chip_service.update_chip("triple-captain", ChipUpdateRequest(active=True))

    assert exc_info.value.issues[0].rule_reference == "chip-usage"


def test_fixture_summary_service_returns_cdl_and_epl_context() -> None:
    service = FixtureSummaryService(create_repository())

    summary = service.get_summary()

    assert summary.cdl_fixtures[0].home_team.id == "team-castle"
    assert summary.epl_fixtures[0].home_team.id == "epl-ars"
    assert summary.cdl_table[0].id == "team-castle"
