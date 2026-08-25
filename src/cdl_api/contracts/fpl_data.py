"""Contracts for official Fantasy Premier League data ingestion."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator


class FplRefreshResource(StrEnum):
    BOOTSTRAP_STATIC = "bootstrap-static"
    FIXTURES = "fixtures"


class FplRefreshRequest(BaseModel):
    resources: list[FplRefreshResource] = Field(
        default_factory=lambda: [
            FplRefreshResource.BOOTSTRAP_STATIC,
            FplRefreshResource.FIXTURES,
        ],
        min_length=1,
    )

    @field_validator("resources")
    @classmethod
    def resources_must_be_unique(
        cls,
        resources: list[FplRefreshResource],
    ) -> list[FplRefreshResource]:
        if len(resources) != len(set(resources)):
            raise ValueError("FPL refresh resources must be unique.")
        return resources


class FplResourceRefreshResult(BaseModel):
    resource: FplRefreshResource
    endpoint: str
    fetched_at: datetime
    response_sha256: str
    records_upserted: dict[str, int]


class FplRefreshResponse(BaseModel):
    resources: list[FplResourceRefreshResult]


class FplResourceStatus(BaseModel):
    resource: FplRefreshResource
    last_updated_at: datetime | None = None
    last_fetch_status: int | None = None
    last_fetch_error: str | None = None
    response_sha256: str | None = None


class FplCacheStatusResponse(BaseModel):
    resources: list[FplResourceStatus]
    normalized_counts: dict[str, int]


class FplPlayerGameweekHistory(BaseModel):
    gameweek: int
    fixture_id: int
    opponent_team_id: int
    total_points: int
    minutes: int
    goals_scored: int = 0
    assists: int = 0
    clean_sheets: int = 0
    saves: int = 0
    yellow_cards: int = 0
    red_cards: int = 0
    own_goals: int = 0
    bonus: int = 0
    bps: int = 0
    expected_goals: float = 0
    expected_assists: float = 0
    value: float = 0
    was_home: bool
    kickoff_time: datetime | None = None
    opponent_name: str | None = None
    opponent_short_name: str | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    defensive_contributions: int = 0


class FplPlayerUpcomingFixture(BaseModel):
    fixture_id: int
    gameweek: int | None = None
    opponent_team_id: int
    difficulty: int
    is_home: bool
    kickoff_time: datetime | None = None
    opponent_name: str | None = None
    opponent_short_name: str | None = None
    opponent_difficulty: int | None = Field(default=None, ge=1, le=5)


class FplOpponentStatIcons(BaseModel):
    goals: int = 0
    assists: int = 0
    clean_sheets: int = 0
    saves: int = 0
    yellow_cards: int = 0
    red_cards: int = 0
    own_goals: int = 0
    defensive_contributions: int = 0
    bonus_points: int = 0


class FplOpponentStatDetail(BaseModel):
    category: str
    player_name: str
    player_position: str | None = None
    value: int | None = None
    points: int = 0


class FplOpponentDefensiveHistory(BaseModel):
    fixture_id: int
    gameweek: int | None = None
    opponent_name: str | None = None
    opponent_short_name: str | None = None
    is_home: bool
    difficulty: int | None = Field(default=None, ge=1, le=5)
    total_points_conceded: int | None = None
    attacking_asset_points: int | None = None
    defensive_asset_points: int | None = None
    stat_icons: FplOpponentStatIcons = Field(default_factory=FplOpponentStatIcons)
    stat_details: list[FplOpponentStatDetail] = Field(default_factory=list)


class FplOpponentDefensiveHistoryGroup(BaseModel):
    opponent_team_id: int
    opponent_name: str | None = None
    opponent_short_name: str | None = None
    fixtures: list[FplOpponentDefensiveHistory] = Field(default_factory=list)


class FplPlayerHistoryResponse(BaseModel):
    player_id: str
    fetched_at: datetime
    response_sha256: str
    history: list[FplPlayerGameweekHistory]
    fixtures: list[FplPlayerUpcomingFixture]
    opponent_defensive_history: list[FplOpponentDefensiveHistory] = Field(default_factory=list)
    opponent_defensive_histories: list[FplOpponentDefensiveHistoryGroup] = Field(
        default_factory=list
    )
