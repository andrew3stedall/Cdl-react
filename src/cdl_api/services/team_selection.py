"""Team selection and chip management services."""

from collections import Counter

from cdl_api.contracts.common import ValidationIssue
from cdl_api.contracts.team_selection import (
    ChipStatus,
    ChipUpdateRequest,
    FixtureLockState,
    FixtureSummaryPanel,
    LineupSlot,
    LineupUpdateRequest,
    TeamSelectionPlayer,
    TeamSelectionResponse,
)
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository

LINEUP_RULE = "lineup-validation"
CHIP_RULE = "chip-usage"
FULL_SQUAD_SIZE = 20
STARTER_LIMITS = {
    "GKP": (1, 1),
    "DEF": (3, 5),
    "MID": (2, 5),
    "FWD": (1, 3),
}


class TeamSelectionValidationError(ValueError):
    def __init__(self, message: str, issues: list[ValidationIssue]) -> None:
        super().__init__(message)
        self.issues = issues


class TeamSelectionLockedError(ValueError):
    def __init__(self, lock: dict[str, object]) -> None:
        super().__init__("Team selection is locked for this gameweek.")
        self.lock = lock


def _fixture_lock_state(repository: InMemoryTeamSelectionRepository) -> FixtureLockState:
    lock = repository.get_fixture_lock()
    if lock is None:
        return FixtureLockState()
    return FixtureLockState(
        locked=True,
        fixture_id=str(lock["fixture_id"]),
        fixture_type=str(lock["fixture_type"]),
        lock_scope=str(lock["lock_scope"]),
        locked_at=str(lock["locked_at"]),
        reason=str(lock["reason"]),
    )


def _ensure_editable(repository: InMemoryTeamSelectionRepository) -> None:
    lock = repository.get_fixture_lock()
    if lock is not None:
        raise TeamSelectionLockedError(lock)


def _lineup_issue(field: str, message: str) -> ValidationIssue:
    return ValidationIssue(field=field, message=message, rule_reference=LINEUP_RULE)


def _normalize_position(position: str) -> str:
    normalized = position.strip().upper()
    if normalized in {"GK", "GOALKEEPER"}:
        return "GKP"
    if normalized == "DEFENDER":
        return "DEF"
    if normalized == "MIDFIELDER":
        return "MID"
    if normalized in {"FORWARD", "STRIKER"}:
        return "FWD"
    return normalized


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
            fixture_lock=_fixture_lock_state(self._repository),
        )

    def update_lineup(self, request: LineupUpdateRequest) -> TeamSelectionResponse:
        _ensure_editable(self._repository)
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
            fixture_lock=_fixture_lock_state(self._repository),
        )

    def validate_updates(self, request: LineupUpdateRequest) -> list[ValidationIssue]:
        known_players = self._repository.get_players()
        known_player_ids = {player.id for player in known_players}
        positions = {player.id: _normalize_position(player.position) for player in known_players}
        requested_ids = {player.player_id for player in request.players}
        starter_count, bench_count, reserve_count = self._slot_counts(len(known_player_ids))
        issues: list[ValidationIssue] = []
        if requested_ids != known_player_ids:
            issues.append(
                _lineup_issue("players", "Lineup update must include every selectable player.")
            )
        starters = [player for player in request.players if player.slot == LineupSlot.STARTER]
        bench = [player for player in request.players if player.slot == LineupSlot.BENCH]
        reserves = [player for player in request.players if player.slot == LineupSlot.RESERVE]
        if len(starters) != starter_count:
            issues.append(
                _lineup_issue(
                    "players",
                    f"Exactly {starter_count} starters are required in this gameweek fixture.",
                )
            )
        if len(bench) != bench_count:
            issues.append(
                _lineup_issue("players", f"Exactly {bench_count} bench players are required.")
            )
        if len(reserves) != reserve_count:
            issues.append(
                _lineup_issue("players", f"Exactly {reserve_count} reserve players are required.")
            )
        if len(known_player_ids) == FULL_SQUAD_SIZE and requested_ids == known_player_ids:
            issues.extend(self._validate_full_selection(starters, bench, positions))
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
        captain = next((player for player in request.players if player.is_captain), None)
        vice_captain = next((player for player in request.players if player.is_vice_captain), None)
        if captain is not None and captain.slot != LineupSlot.STARTER:
            issues.append(
                ValidationIssue(
                    field="captain",
                    message="Captain must be selected in the Starting XI.",
                    rule_reference="captaincy",
                )
            )
        if vice_captain is not None and vice_captain.slot != LineupSlot.STARTER:
            issues.append(
                ValidationIssue(
                    field="vice_captain",
                    message="Vice captain must be selected in the Starting XI.",
                    rule_reference="captaincy",
                )
            )
        if (
            captain is not None
            and vice_captain is not None
            and captain.player_id == vice_captain.player_id
        ):
            issues.append(
                ValidationIssue(
                    field="vice_captain",
                    message="Captain and vice captain must be different players.",
                    rule_reference="captaincy",
                )
            )
        return issues

    def _validate_full_selection(
        self,
        starters: list[object],
        bench: list[object],
        positions: dict[str, str],
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        starter_positions = Counter(positions[player.player_id] for player in starters)
        for position, (minimum, maximum) in STARTER_LIMITS.items():
            count = starter_positions[position]
            if not minimum <= count <= maximum:
                issues.append(
                    _lineup_issue(
                        "players",
                        f"Starting XI requires {minimum}-{maximum} {position}; selected {count}.",
                    )
                )

        bench_goalkeepers = [player for player in bench if positions[player.player_id] == "GKP"]
        bench_outfield = [player for player in bench if positions[player.player_id] != "GKP"]
        if len(bench_goalkeepers) != 1:
            issues.append(
                _lineup_issue("players", "Bench must contain exactly one goalkeeper.")
            )
        if len(bench_outfield) != 4:
            issues.append(
                _lineup_issue("players", "Bench must contain exactly four outfield substitutes.")
            )
        if len(bench_goalkeepers) == 1 and bench_goalkeepers[0].slot_order != 0:
            issues.append(
                _lineup_issue(
                    "players",
                    "The substitute goalkeeper uses the goalkeeper bench slot, separate from outfield order.",
                )
            )
        if len(bench_outfield) == 4:
            outfield_order = sorted(player.slot_order for player in bench_outfield)
            if outfield_order != [1, 2, 3, 4]:
                issues.append(
                    _lineup_issue(
                        "players",
                        "The four outfield substitutes must be ordered 1 through 4.",
                    )
                )
        return issues

    def validate_players(self, players: list[TeamSelectionPlayer]) -> list[ValidationIssue]:
        starters = [player for player in players if player.slot == LineupSlot.STARTER]
        bench = [player for player in players if player.slot == LineupSlot.BENCH]
        reserves = [player for player in players if player.slot == LineupSlot.RESERVE]
        starter_count, bench_count, reserve_count = self._slot_counts(len(players))
        issues: list[ValidationIssue] = []
        if len(starters) != starter_count:
            issues.append(
                _lineup_issue("players", f"Team selection needs exactly {starter_count} starters.")
            )
        if len(players) != FULL_SQUAD_SIZE:
            return issues
        if len(bench) != bench_count:
            issues.append(
                _lineup_issue("players", f"Team selection needs exactly {bench_count} bench players.")
            )
        if len(reserves) != reserve_count:
            issues.append(
                _lineup_issue(
                    "players", f"Team selection needs exactly {reserve_count} reserve players."
                )
            )
        starter_positions = Counter(_normalize_position(player.position) for player in starters)
        for position, (minimum, maximum) in STARTER_LIMITS.items():
            count = starter_positions[position]
            if not minimum <= count <= maximum:
                issues.append(
                    _lineup_issue(
                        "players",
                        f"Starting XI requires {minimum}-{maximum} {position}; selected {count}.",
                    )
                )
        bench_goalkeepers = [
            player for player in bench if _normalize_position(player.position) == "GKP"
        ]
        bench_outfield = [
            player for player in bench if _normalize_position(player.position) != "GKP"
        ]
        if len(bench_goalkeepers) != 1:
            issues.append(_lineup_issue("players", "Bench must contain exactly one goalkeeper."))
        if len(bench_outfield) != 4:
            issues.append(
                _lineup_issue("players", "Bench must contain exactly four outfield substitutes.")
            )
        return issues

    @staticmethod
    def _slot_counts(player_count: int) -> tuple[int, int, int]:
        return (11, 5, 4) if player_count == FULL_SQUAD_SIZE else (3, 1, 1)


class ChipService:
    def __init__(self, repository: InMemoryTeamSelectionRepository) -> None:
        self._repository = repository

    def update_chip(self, chip_id: str, request: ChipUpdateRequest) -> TeamSelectionResponse:
        _ensure_editable(self._repository)
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
