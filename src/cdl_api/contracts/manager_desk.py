"""Read model contracts for the context-aware Manager's Desk."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from cdl_api.contracts.domain import GameweekSummary
from cdl_api.contracts.league_models import (
    LeagueFixture,
    LeagueTableResponse,
)
from cdl_api.contracts.squad import PlayerDetail
from cdl_api.contracts.squad_workspace import SquadWorkspaceResponse
from cdl_api.contracts.team_selection import TeamSelectionResponse


class ManagerDeskContext(StrEnum):
    PRE_DEADLINE = "pre_deadline"
    LIVE = "live"
    FINALISED = "finalised"


class ManagerDeskResponse(BaseModel):
    """Everything needed for the first Manager's Desk render."""

    context: ManagerDeskContext
    gameweek: GameweekSummary
    selection: TeamSelectionResponse
    squad: SquadWorkspaceResponse
    current_fixture: LeagueFixture | None = None
    next_fixture: LeagueFixture | None = None
    current_fixtures: list[LeagueFixture] = Field(default_factory=list)
    next_fixtures: list[LeagueFixture] = Field(default_factory=list)
    recent_fixtures: list[LeagueFixture] = Field(default_factory=list)
    form_fixtures: list[LeagueFixture] = Field(default_factory=list)
    league_table: LeagueTableResponse
    available_players: list[PlayerDetail] = Field(default_factory=list)
    draw_deadline_at: datetime | None = None
    interest_count: int = 0
