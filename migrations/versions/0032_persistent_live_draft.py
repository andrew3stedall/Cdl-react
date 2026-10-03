"""Persist configured league live-draft rooms, queues, picks and activity."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0032_persistent_live_draft"
down_revision: str | None = "0031_persistent_loans"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "live_drafts",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("league_id", sa.String(64), sa.ForeignKey("leagues.id"), nullable=False),
        sa.Column("season_id", sa.String(64), sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("mode", sa.String(32), nullable=False),
        sa.Column("team_order", sa.JSON(), nullable=False),
        sa.Column("rounds", sa.Integer(), nullable=False),
        sa.Column("pick_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clock_enabled", sa.Integer(), nullable=False),
        sa.Column("pick_seconds", sa.Integer(), nullable=True),
        sa.Column("clock_seconds_remaining", sa.Integer(), nullable=True),
        sa.Column("clock_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clock_deadline_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.String(64), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("league_id", "season_id", name="uq_live_drafts_league_season"),
    )
    op.create_table(
        "live_draft_picks",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "draft_id",
            sa.String(64),
            sa.ForeignKey("live_drafts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("pick_index", sa.Integer(), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.String(64), sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("player_id", sa.String(64), sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("source", sa.String(40), nullable=False),
        sa.Column("actor_user_id", sa.String(64), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column("picked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("seconds_taken", sa.Integer(), nullable=True),
        sa.UniqueConstraint("draft_id", "pick_index", name="uq_live_draft_pick_position"),
        sa.UniqueConstraint("draft_id", "player_id", name="uq_live_draft_player"),
        sa.UniqueConstraint("draft_id", "idempotency_key", name="uq_live_draft_idempotency"),
    )
    op.create_table(
        "live_draft_queue",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "draft_id",
            sa.String(64),
            sa.ForeignKey("live_drafts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("team_id", sa.String(64), sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("player_id", sa.String(64), sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.UniqueConstraint("draft_id", "team_id", "player_id", name="uq_live_draft_queue_player"),
    )
    op.create_table(
        "live_draft_events",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "draft_id",
            sa.String(64),
            sa.ForeignKey("live_drafts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("actor_user_id", sa.String(64), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("team_id", sa.String(64), sa.ForeignKey("draft_teams.id"), nullable=True),
        sa.Column("player_id", sa.String(64), sa.ForeignKey("fpl_players.id"), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_live_draft_events_draft_created", "live_draft_events", ["draft_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_live_draft_events_draft_created", table_name="live_draft_events")
    op.drop_table("live_draft_events")
    op.drop_table("live_draft_queue")
    op.drop_table("live_draft_picks")
    op.drop_table("live_drafts")
