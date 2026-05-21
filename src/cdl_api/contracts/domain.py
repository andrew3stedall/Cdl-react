"""Shared domain summary contracts used across feature APIs."""

from pydantic import BaseModel


class TeamSummary(BaseModel):
    id: str
    name: str
    short_name: str | None = None


class PlayerSummary(BaseModel):
    id: str
    display_name: str
    position: str | None = None
    team: TeamSummary | None = None


class GameweekSummary(BaseModel):
    id: str
    name: str
    number: int


class FixtureSummary(BaseModel):
    id: str
    gameweek: GameweekSummary
    home_team: TeamSummary
    away_team: TeamSummary
    status: str
