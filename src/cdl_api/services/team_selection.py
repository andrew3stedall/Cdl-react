"""Team selection and chip management services."""

from cdl_api.contracts.common import ValidationIssue
from cdl_api.contracts.team_selection import (
    ChipStatus,
    ChipUpdateRequest,
    FixtureSummaryPanel,
    LineupSlot,
    LineupUpdateRequest,
    TeamSelectionPlayer,
    TeamSelectionResponse,
)
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository

LINEUP_RULE = "lineup-validation"
CHIP_RULE = "chip-usage"


class TeamSelectionValidationError(ValueError):
    def __init__(self, message: str, issues: list[ValidationIssue]) -> None:
        super().__init__(message)
        self.issues = issues


class TeamSelectionService:
    def __init__(self, repository: InMemoryTeamSelectionRepository) -> None:
        self._repository = repository

    def get_team_selection(self) -> TeamSelectionResponse:
        players = self._repository.get_players()
        return TeamSelectionResponse(
            manager_team=self._repository.manager_team,
            gameweek=self._repository.gameweek,
            lineup=players,
            chips=self._repository.get_chips(),
            validation_messages=self.validate_players(players),
        )

    def update_lineup(self, request: LineupUpdateRequest) -> TeamSelectionResponse:
        issues = self.validate_updates(request)
        if issues:
            raise TeamSelectionValidationError("Invalid team selection lineup.", issues)
        players = self._repository.save_lineup(request.players)
        return TeamSelectionResponse(
            manager_team=self._repository.manager_team,
            gameweek=self._repository.gameweek,
            lineup=players,
            chips=self._repository.get_chips(),
            validation_messages=[],
        )

    def validate_updates(self, request: LineupUpdateRequest) -> list[ValidationIssue]:
        known_player_ids = {player.id for player in self._repository.get_players()}
        requested_ids = {player.player_id for player in request.players}
        issues: list[ValidationIssue] = []
        if requested_ids != known_player_ids:
            issues.append(
                ValidationIssue(
                    field="players",
                    message="Lineup update must include every selectable player.",
                    rule_reference=LINEUP_RULE,
                )
            )
        starters = [player for player in request.players if player.slot == LineupSlot.STARTER]
        bench = [player for player in request.players if player.slot == LineupSlot.BENCH]
        reserves = [player for player in request.players if player.slot == LineupSlot.RESERVE]
        if len(starters) != 3:
            issues.append(
                ValidationIssue(
                    field="players",
                    message="Exactly three starters are required in this gameweek fixture.",
                    rule_reference=LINEUP_RULE,
                )
            )
        if len(bench) != 1:
            issues.append(
                ValidationIssue(
                    field="players",
                    message="Exactly one bench player is required.",
                    rule_reference=LINEUP_RULE,
                )
            )
        if len(reserves) != 1:
            issues.append(
                ValidationIssue(
                    field="players",
                    message="Exactly one reserve player is required.",
                    rule_reference=LINEUP_RULE,
                )
            )
        if sum(1 for player in request.players if player.is_captain) != 1:
            issues.append(
                ValidationIssue(
                    field="captain",
                    message="Exactly one captain is required.",
                    rule_reference="captaincy",
                )
            )
        if sum(1 for player in request.players if player.is_vice_captain) != 1:
            issues.append(
                ValidationIssue(
                    field="vice_captain",
                    message="Exactly one vice captain is required.",
                    rule_reference="captaincy",
                )
            )
        return issues

    def validate_players(self, players: list[TeamSelectionPlayer]) -> list[ValidationIssue]:
        starters = [player for player in players if player.slot == LineupSlot.STARTER]
        if len(starters) == 3:
            return []
        return [
            ValidationIssue(
                field="players",
                message="Team selection needs exactly three starters.",
                rule_reference=LINEUP_RULE,
            )
        ]


class ChipService:
    def __init__(self, repository: InMemoryTeamSelectionRepository) -> None:
        self._repository = repository

    def update_chip(self, chip_id: str, request: ChipUpdateRequest) -> TeamSelectionResponse:
        chips = self._repository.get_chips()
        chip = next((candidate for candidate in chips if candidate.id == chip_id), None)
        if chip is None:
            raise TeamSelectionValidationError(
                "Unknown chip.",
                [self._chip_issue("Chip could not be found.")],
            )
        if chip.status == ChipStatus.USED:
            raise TeamSelectionValidationError(
                "Chip has already been used.",
                [self._chip_issue("Used chips cannot be activated.")],
            )
        active_chips = [
            candidate
            for candidate in chips
            if candidate.status == ChipStatus.ACTIVE and candidate.id != chip_id
        ]
        if request.active and active_chips:
            raise TeamSelectionValidationError(
                "Only one chip can be active at a time.",
                [self._chip_issue("Deactivate the active chip first.")],
            )
        chip.status = ChipStatus.ACTIVE if request.active else ChipStatus.AVAILABLE
        self._repository.save_chips(chips)
        return TeamSelectionService(self._repository).get_team_selection()

    def _chip_issue(self, message: str) -> ValidationIssue:
        return ValidationIssue(
            field="chip_id",
            message=message,
            rule_reference=CHIP_RULE,
        )


class FixtureSummaryService:
    def __init__(self, repository: InMemoryTeamSelectionRepository) -> None:
        self._repository = repository

    def get_summary(self) -> FixtureSummaryPanel:
        cdl_fixtures, epl_fixtures, cdl_table, epl_table = self._repository.fixture_summary()
        return FixtureSummaryPanel(
            cdl_fixtures=cdl_fixtures,
            epl_fixtures=epl_fixtures,
            cdl_table=cdl_table,
            epl_table=epl_table,
        )
