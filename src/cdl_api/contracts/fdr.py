"""Fixture difficulty rating contracts."""

from datetime import datetime
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


class FixtureDifficultyCalculationFixtureInput(BaseModel):
    """Versioned fixture input consumed by the deterministic FDR owner."""

    id: str
    team: TeamSummary
    opponent: TeamSummary
    gameweek: int = Field(ge=1, le=38)
    venue: str = Field(pattern="^[HA]$")
    attack_difficulty_score: float = Field(ge=1, le=5)
    defence_difficulty_score: float = Field(ge=1, le=5)


class FixtureDifficultyCalculationInputAudit(BaseModel):
    """Versioned metadata linking stored ratings to one calculation input run."""

    id: str
    season: str
    contract_version: str
    algorithm_version: str
    calculation_run_id: str
    source: str
    captured_at: datetime
    calculated_at: datetime
    fixture_count: int = Field(ge=0)
    input_sha256: str = Field(min_length=64, max_length=64)
    synthetic: bool


class FixtureDifficultyCalculationRunResult(BaseModel):
    """Idempotent persistence result for one FDR calculation run."""

    season: str
    calculation_run_id: str
    algorithm_version: str
    created_ratings: int = Field(ge=0)
    unchanged_ratings: int = Field(ge=0)
