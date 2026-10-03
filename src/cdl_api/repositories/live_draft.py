"""Durable live-draft room storage for the configured league and season."""

from __future__ import annotations

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    UniqueConstraint,
)

metadata = MetaData()

live_drafts_table = Table(
    "live_drafts",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("league_id", String(64), ForeignKey("leagues.id"), nullable=False),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("status", String(32), nullable=False),
    Column("mode", String(32), nullable=False),
    Column("team_order", JSON, nullable=False),
    Column("rounds", Integer, nullable=False),
    Column("pick_index", Integer, nullable=False, default=0),
    Column("clock_enabled", Integer, nullable=False),
    Column("pick_seconds", Integer, nullable=True),
    Column("clock_seconds_remaining", Integer, nullable=True),
    Column("clock_started_at", DateTime(timezone=True), nullable=True),
    Column("clock_deadline_at", DateTime(timezone=True), nullable=True),
    Column("created_by_user_id", String(64), ForeignKey("users.id"), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    UniqueConstraint("league_id", "season_id", name="uq_live_drafts_league_season"),
)

live_draft_picks_table = Table(
    "live_draft_picks",
    metadata,
    Column("id", String(64), primary_key=True),
    Column(
        "draft_id", String(64), ForeignKey("live_drafts.id", ondelete="CASCADE"), nullable=False
    ),
    Column("pick_index", Integer, nullable=False),
    Column("round_number", Integer, nullable=False),
    Column("team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("source", String(40), nullable=False),
    Column("actor_user_id", String(64), ForeignKey("users.id"), nullable=True),
    Column("idempotency_key", String(128), nullable=True),
    Column("picked_at", DateTime(timezone=True), nullable=False),
    Column("seconds_taken", Integer, nullable=True),
    UniqueConstraint("draft_id", "pick_index", name="uq_live_draft_pick_position"),
    UniqueConstraint("draft_id", "player_id", name="uq_live_draft_player"),
    UniqueConstraint("draft_id", "idempotency_key", name="uq_live_draft_idempotency"),
)

live_draft_queue_table = Table(
    "live_draft_queue",
    metadata,
    Column("id", String(64), primary_key=True),
    Column(
        "draft_id", String(64), ForeignKey("live_drafts.id", ondelete="CASCADE"), nullable=False
    ),
    Column("team_id", String(64), ForeignKey("draft_teams.id"), nullable=False),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=False),
    Column("rank", Integer, nullable=False),
    UniqueConstraint("draft_id", "team_id", "player_id", name="uq_live_draft_queue_player"),
)

live_draft_events_table = Table(
    "live_draft_events",
    metadata,
    Column("id", String(64), primary_key=True),
    Column(
        "draft_id", String(64), ForeignKey("live_drafts.id", ondelete="CASCADE"), nullable=False
    ),
    Column("event_type", String(64), nullable=False),
    Column("actor_user_id", String(64), ForeignKey("users.id"), nullable=True),
    Column("team_id", String(64), ForeignKey("draft_teams.id"), nullable=True),
    Column("player_id", String(64), ForeignKey("fpl_players.id"), nullable=True),
    Column("details", JSON, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
