"""Squad management, scouting, interest, and trade contracts."""

from enum import StrEnum

from pydantic import BaseModel, Field

from cdl_api.contracts.common import RuleReference, ValidationIssue
from cdl_api.contracts.domain import GameweekSummary, PlayerSummary, TeamSummary


class PlayerPosition(StrEnum):
    GOALKEEPER = "GKP"
    DEFENDER = "DEF"
    MIDFIELDER = "MID"
    FORWARD = "FWD"


class PlayerMetric(StrEnum):
    TOTAL_POINTS = "total_points"
    FORM = "form"
    VALUE = "value"


class PlayerOwnershipStatus(StrEnum):
    OWNED = "owned"
    AVAILABLE = "available"
    INTERESTED = "interested"
    TRADE_TARGET = "trade_target"


class PlayerDetail(PlayerSummary):
    epl_team: TeamSummary
    draft_team: TeamSummary | None = None
    status: PlayerOwnershipStatus
    points: int = 0
    form: float = 0
    value: float = 0
    selected_by_percent: float = 0


class ScoutingFilters(BaseModel):
    position: PlayerPosition | None = None
    draft_team_id: str | None = None
    epl_team_id: str | None = None
    query: str | None = None
    metric: PlayerMetric = PlayerMetric.TOTAL_POINTS


class SquadSummaryResponse(BaseModel):
    manager_team: TeamSummary
    gameweek: GameweekSummary
    players: list[PlayerDetail]
    total_players: int
    positional_totals: dict[PlayerPosition, int]
    squad_value: float
    validation_messages: list[ValidationIssue] = Field(default_factory=list)


class ScoutingPlayersResponse(BaseModel):
    filters: ScoutingFilters
    players: list[PlayerDetail]


class InterestCreateRequest(BaseModel):
    player_id: str
    note: str | None = None


class InterestResponse(BaseModel):
    id: str
    player: PlayerDetail
    gameweek: GameweekSummary
    note: str | None = None


class InterestDeleteResponse(BaseModel):
    deleted_interest_id: str


class TradeStatus(StrEnum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class TradeCreateRequest(BaseModel):
    offered_to_team_id: str
    offered_player_ids: list[str] = Field(min_length=1)
    requested_player_ids: list[str] = Field(min_length=1)
    note: str | None = None


class TradeUpdateRequest(BaseModel):
    status: TradeStatus


class TradeAsset(BaseModel):
    player: PlayerDetail
    from_team: TeamSummary
    to_team: TeamSummary


class TradeProposal(BaseModel):
    id: str
    status: TradeStatus
    offered_by: TeamSummary
    offered_to: TeamSummary
    gameweek: GameweekSummary
    assets: list[TradeAsset]
    rule_references: list[RuleReference] = Field(default_factory=list)
    validation_messages: list[ValidationIssue] = Field(default_factory=list)


class TradesResponse(BaseModel):
    trades: list[TradeProposal]
