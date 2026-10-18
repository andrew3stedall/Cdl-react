"""Read-only contracts for companion applications."""

from datetime import datetime

from pydantic import BaseModel, Field


class CompanionTeam(BaseModel):
    id: str
    name: str
    manager_name: str | None = None


class CompanionTeamsResponse(BaseModel):
    teams: list[CompanionTeam] = Field(default_factory=list)


class CompanionDraftPick(BaseModel):
    pick_number: int
    round_number: int
    team_id: str
    team_name: str
    player_id: str
    player_name: str
    picked_at: datetime
    source: str


class CompanionDraftPicksResponse(BaseModel):
    draft_id: str | None = None
    status: str | None = None
    picks: list[CompanionDraftPick] = Field(default_factory=list)


class CompanionDrawAward(BaseModel):
    team_id: str
    team_name: str
    player_id: str | None = None
    player_name: str | None = None
    preference_rank: int | None = None
    reason_code: str


class CompanionDrawResult(BaseModel):
    draw_id: str
    gameweek: int
    status: str
    processed_at: datetime | None = None
    awards: list[CompanionDrawAward] = Field(default_factory=list)


class CompanionDrawResultsResponse(BaseModel):
    draws: list[CompanionDrawResult] = Field(default_factory=list)


class CompanionSquadMovement(BaseModel):
    id: str
    event: str
    occurred_at: datetime
    team_id: str
    team_name: str
    player_id: str
    player_name: str


class CompanionSquadMovementsResponse(BaseModel):
    movements: list[CompanionSquadMovement] = Field(default_factory=list)


class CompanionTradeAsset(BaseModel):
    player_id: str
    player_name: str
    from_team_id: str
    from_team_name: str
    to_team_id: str
    to_team_name: str


class CompanionTrade(BaseModel):
    id: str
    gameweek: int
    executed_at: datetime
    assets: list[CompanionTradeAsset] = Field(default_factory=list)


class CompanionTradesResponse(BaseModel):
    trades: list[CompanionTrade] = Field(default_factory=list)


class CompanionSelectionPlayer(BaseModel):
    player_id: str
    player_name: str
    position: str
    slot: str
    slot_order: int
    is_captain: bool
    is_vice_captain: bool


class CompanionTeamSelection(BaseModel):
    team_id: str
    team_name: str
    gameweek: int
    locked_at: datetime
    players: list[CompanionSelectionPlayer] = Field(default_factory=list)


class CompanionTeamSelectionsResponse(BaseModel):
    gameweek: int | None = None
    selections: list[CompanionTeamSelection] = Field(default_factory=list)
