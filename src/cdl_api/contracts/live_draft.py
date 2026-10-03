"""Contracts for the persistent live draft room."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DraftMode = Literal["random_repeat", "snake", "manual"]


class CreateDraftRequest(BaseModel):
    mode: DraftMode
    rounds: Literal[20] = 20
    clock_enabled: bool = False
    pick_seconds: int | None = Field(default=None, ge=10, le=3600)
    manual_team_order: list[str] | None = None


class PickRequest(BaseModel):
    player_id: str
    idempotency_key: str = Field(min_length=1, max_length=128)


class AutoPickRequest(BaseModel):
    idempotency_key: str = Field(min_length=1, max_length=128)


class CorrectionRequest(BaseModel):
    player_id: str
    reason: str = Field(min_length=5, max_length=512)


class QueueRequest(BaseModel):
    player_ids: list[str] = Field(max_length=500)


class DraftPickView(BaseModel):
    pick_number: int
    round_number: int
    team_id: str
    team_name: str
    player_id: str
    player_name: str
    source: str
    picked_at: datetime
    seconds_taken: int | None


class DraftRoomView(BaseModel):
    id: str
    status: str
    mode: DraftMode
    rounds: int
    pick_number: int | None
    current_team_id: str | None
    current_team_name: str | None
    clock_enabled: bool
    pick_seconds: int | None
    clock_started_at: datetime | None
    clock_deadline_at: datetime | None
    picks: list[DraftPickView]
    available_players: list[dict[str, object]]
    my_queue: list[str]
    events: list[dict[str, object]]
