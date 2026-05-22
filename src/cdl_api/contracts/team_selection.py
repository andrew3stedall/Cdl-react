"""Team selection and chip management contracts."""

from enum import StrEnum

from pydantic import BaseModel, Field

from cdl_api.contracts.common import RuleReference, ValidationIssue
from cdl_api.contracts.domain import FixtureSummary, GameweekSummary, PlayerSummary, TeamSummary


class LineupSlot(StrEnum):
    STARTER = "starter"
    BENCH = "bench"
    RESERVE = "reserve"


class ChipStatus(StrEnum):
    AVAILABLE = "available"
    ACTIVE = "active"
    USED = "used"


class TeamSelectionPlayer(PlayerSummary):
    epl_team: TeamSummary
    slot: LineupSlot
    slot_order: int
    is_captain: bool = False
    is_vice_captain: bool = False


class ChipState(BaseModel):
    id: str
    name: str
    status: ChipStatus
    rule_reference: RuleReference | None = None


class TeamSelectionResponse(BaseModel):
    manager_team: TeamSummary
    gameweek: GameweekSummary
    lineup: list[TeamSelectionPlayer]
    chips: list[ChipState]
    validation_messages: list[ValidationIssue] = Field(default_factory=list)


class LineupPlayerUpdate(BaseModel):
    player_id: str
    slot: LineupSlot
    slot_order: int
    is_captain: bool = False
    is_vice_captain: bool = False


class LineupUpdateRequest(BaseModel):
    players: list[LineupPlayerUpdate]


class ChipUpdateRequest(BaseModel):
    active: bool


class FixtureSummaryPanel(BaseModel):
    cdl_fixtures: list[FixtureSummary]
    epl_fixtures: list[FixtureSummary]
    cdl_table: list[TeamSummary]
    epl_table: list[TeamSummary]


class TeamSelectionValidationResponse(BaseModel):
    valid: bool
    validation_messages: list[ValidationIssue]
