"""League fixture and table contract models."""

from enum import StrEnum

from pydantic import BaseModel, Field

from cdl_api.contracts.domain import FixtureSummary, GameweekSummary, TeamSummary


class FixtureStatus(StrEnum):
    PENDING = "pending"
    STARTED = "started"
    COMPLETE = "complete"


class FixtureOutcome(StrEnum):
    HOME_WIN = "home_win"
    AWAY_WIN = "away_win"
    DRAW = "draw"
    PENDING = "pending"


class FixtureScore(BaseModel):
    home_score: int | None = None
    away_score: int | None = None
    bonus_points: dict[str, int] = Field(default_factory=dict)
    chips_played: dict[str, list[str]] = Field(default_factory=dict)
    outcome: FixtureOutcome = FixtureOutcome.PENDING


class LeagueFixture(FixtureSummary):
    kickoff_label: str
    round_label: str
    is_current: bool = False
    is_next: bool = False
    detail_available: bool = False
    score: FixtureScore = Field(default_factory=FixtureScore)


class FixtureEvent(BaseModel):
    label: str
    team: TeamSummary
    points: int
    rule_reference: str | None = None


class FixtureDetailResponse(BaseModel):
    fixture: LeagueFixture
    events: list[FixtureEvent] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class LeagueFixturesResponse(BaseModel):
    gameweek: GameweekSummary | None
    fixtures: list[LeagueFixture]


class LeagueTableRow(BaseModel):
    position: int
    team: TeamSummary
    played: int
    wins: int
    draws: int
    losses: int
    points_for: int
    points_against: int
    points_difference: int
    league_points: int


class LeagueTableResponse(BaseModel):
    rows: list[LeagueTableRow]
    source: str = "service-calculated"


class KnockoutMatch(BaseModel):
    id: str
    round_label: str
    fixture: LeagueFixture
    winner: TeamSummary | None = None


class KnockoutResponse(BaseModel):
    rounds: list[str]
    matches: list[KnockoutMatch]


class HeadToHeadRecord(BaseModel):
    team: TeamSummary
    opponent: TeamSummary
    played: int
    wins: int
    draws: int
    losses: int
    points_for: int
    points_against: int


class HeadToHeadResponse(BaseModel):
    records: list[HeadToHeadRecord]
