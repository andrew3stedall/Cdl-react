"""Fixture difficulty rating contracts."""

from enum import StrEnum

from pydantic import BaseModel, Field

from cdl_api.contracts.domain import GameweekSummary, TeamSummary


class FixtureDifficultyView(StrEnum):
    ATTACK = "attack"
    DEFENCE = "defence"


class FixtureDifficultyBand(StrEnum):
    VERY_EASY = "very_easy"
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    VERY_HARD = "very_hard"


class FixtureDifficultyScaleStep(BaseModel):
    rating: int = Field(ge=1, le=5)
    band: FixtureDifficultyBand
    label: str
    foreground_token: str
    background_token: str
    contrast_ratio: float = Field(ge=4.5)


class FixtureDifficultyFixture(BaseModel):
    id: str
    opponent: TeamSummary
    gameweek: GameweekSummary
    venue: str
    rating: int = Field(ge=1, le=5)
    band: FixtureDifficultyBand
    abbreviation: str


class FixtureDifficultyRow(BaseModel):
    team: TeamSummary
    fixtures: list[FixtureDifficultyFixture]
    average_rating: float


class FixtureDifficultyFilters(BaseModel):
    season: str = "2025/26"
    team_id: str | None = None
    gameweek_start: int = Field(default=12, ge=1, le=38)
    gameweek_end: int = Field(default=16, ge=1, le=38)


class FixtureDifficultyResponse(BaseModel):
    view: FixtureDifficultyView
    filters: FixtureDifficultyFilters
    scales: list[FixtureDifficultyScaleStep]
    rows: list[FixtureDifficultyRow]
    available_teams: list[TeamSummary]
    available_gameweeks: list[GameweekSummary]


class FixtureDifficultyCombinedResponse(BaseModel):
    attack: FixtureDifficultyResponse
    defence: FixtureDifficultyResponse
    scales: list[FixtureDifficultyScaleStep]
