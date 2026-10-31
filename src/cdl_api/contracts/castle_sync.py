"""Configuration for an explicit Castle source-to-CDL binding."""

from typing import Literal

from pydantic import BaseModel, Field


class CastleSyncConfig(BaseModel):
    source_league_id: str = ""
    target_league_id: str = "league-cdl-2026-27"
    target_season_id: str = "season-cdl-2026-27"
    projection: Literal["archive", "native"] = "archive"
    adopt_existing: bool = False
    team_aliases: dict[str, str] = Field(default_factory=dict)
    player_ids: dict[str, str] = Field(default_factory=dict)
    trade_gameweeks: dict[str, int] = Field(default_factory=dict)
    native_entities: list[
        Literal[
            "team_selection_lineup_slots",
            "cdl_fixtures",
            "fixture_results",
            "trade_proposals",
            "trade_assets",
            "squad_rejection_reasons",
        ]
    ] = Field(default_factory=list)
    restore_missing: bool = False
    lineup_gameweek: int | None = Field(default=None, ge=1)
    replace_current_gameweek_synthetic: bool = False
