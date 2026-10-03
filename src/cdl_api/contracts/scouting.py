"""Private scouting and league ownership history contracts."""

from datetime import datetime

from pydantic import BaseModel, Field


class ScoutingNoteUpdate(BaseModel):
    watchlisted: bool = False
    note: str = Field(default="", max_length=4000)


class ScoutingNote(ScoutingNoteUpdate):
    player_id: str
    updated_at: datetime | None = None


class OwnershipPeriod(BaseModel):
    id: str
    season_id: str
    season_name: str
    team_id: str
    team_name: str
    started_at: datetime
    ended_at: datetime | None = None


class OwnershipHistory(BaseModel):
    player_id: str
    periods: list[OwnershipPeriod]
