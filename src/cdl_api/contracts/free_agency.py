"""Ranked free-agency draw contracts."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class FreeAgencyDrawStatus(StrEnum):
    SCHEDULED = "scheduled"
    OPEN_FOR_PREFERENCES = "open_for_preferences"
    LOCKED = "locked"
    PROCESSING = "processing"
    PROCESSED = "processed"
    CANCELLED = "cancelled"
    CORRECTED = "corrected"


class FreeAgencyDrawCreateRequest(BaseModel):
    gameweek: int = Field(ge=1)
    opens_at: datetime | None = None
    closes_at: datetime


class FreeAgencyDrawResponse(BaseModel):
    id: str
    season_id: str
    gameweek: int
    status: FreeAgencyDrawStatus
    opens_at: datetime | None = None
    closes_at: datetime
    processed_at: datetime | None = None
    draw_order: list[str] = Field(default_factory=list)


class FreeAgencyPreferencesRequest(BaseModel):
    player_ids: list[str] = Field(max_length=100)


class FreeAgencyPreference(BaseModel):
    player_id: str
    rank: int


class FreeAgencyPublicAward(BaseModel):
    draft_team_id: str
    team_name: str
    player_id: str
    player_name: str


class FreeAgencyManagerResult(BaseModel):
    draft_team_id: str
    won_player_id: str | None = None
    preference_rank: int | None = None
    reason_code: str


class FreeAgencyResultsResponse(BaseModel):
    draw: FreeAgencyDrawResponse
    awards: list[FreeAgencyPublicAward] = Field(default_factory=list)
    own_preferences: list[FreeAgencyPreference] = Field(default_factory=list)
    own_result: FreeAgencyManagerResult | None = None
