"""Persist trade approvals and ranked free-agency draws."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0030_movement_workflows"
down_revision: str | None = "0029_targeted_league_invites"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "trade_proposals",
        sa.Column(
            "approval_status",
            sa.String(length=64),
            nullable=False,
            server_default="not_submitted",
        ),
    )
    op.add_column(
        "trade_proposals",
        sa.Column("required_approver_role", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "trade_proposals",
        sa.Column("approved_by_manager_id", sa.String(length=64), nullable=True),
    )
    op.create_foreign_key(
        "fk_trade_proposals_approved_by_manager_id",
        "trade_proposals",
        "managers",
        ["approved_by_manager_id"],
        ["id"],
    )
    op.add_column(
        "trade_proposals",
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE trade_proposals SET approval_status = 'pending' WHERE status = 'accepted'")

    op.create_table(
        "free_agency_draws",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("season_id", sa.String(length=64), sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("opens_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("season_id", "gameweek", name="uq_free_agency_draw_season_gameweek"),
    )
    op.create_table(
        "free_agency_draw_order",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "draw_id", sa.String(length=64), sa.ForeignKey("free_agency_draws.id"), nullable=False
        ),
        sa.Column(
            "draft_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("draw_id", "draft_team_id", name="uq_free_agency_draw_order_team"),
        sa.UniqueConstraint("draw_id", "position", name="uq_free_agency_draw_order_position"),
    )
    op.create_table(
        "free_agency_preferences",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "draw_id", sa.String(length=64), sa.ForeignKey("free_agency_draws.id"), nullable=False
        ),
        sa.Column(
            "draft_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False
        ),
        sa.Column("manager_id", sa.String(length=64), sa.ForeignKey("managers.id"), nullable=False),
        sa.Column(
            "player_id", sa.String(length=64), sa.ForeignKey("fpl_players.id"), nullable=False
        ),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "draw_id", "draft_team_id", "rank", name="uq_free_agency_preference_rank"
        ),
        sa.UniqueConstraint(
            "draw_id", "draft_team_id", "player_id", name="uq_free_agency_preference_player"
        ),
    )
    op.create_table(
        "free_agency_results",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "draw_id", sa.String(length=64), sa.ForeignKey("free_agency_draws.id"), nullable=False
        ),
        sa.Column(
            "draft_team_id", sa.String(length=64), sa.ForeignKey("draft_teams.id"), nullable=False
        ),
        sa.Column(
            "player_id", sa.String(length=64), sa.ForeignKey("fpl_players.id"), nullable=True
        ),
        sa.Column("preference_rank", sa.Integer(), nullable=True),
        sa.Column("reason_code", sa.String(length=64), nullable=False),
        sa.Column(
            "temporary_right_id",
            sa.String(length=64),
            sa.ForeignKey("player_rights.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("draw_id", "draft_team_id", name="uq_free_agency_result_team"),
        sa.UniqueConstraint("draw_id", "player_id", name="uq_free_agency_result_player"),
    )
    op.create_table(
        "free_agency_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "draw_id", sa.String(length=64), sa.ForeignKey("free_agency_draws.id"), nullable=False
        ),
        sa.Column(
            "actor_manager_id", sa.String(length=64), sa.ForeignKey("managers.id"), nullable=True
        ),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )


def downgrade() -> None:
    op.drop_table("free_agency_events")
    op.drop_table("free_agency_results")
    op.drop_table("free_agency_preferences")
    op.drop_table("free_agency_draw_order")
    op.drop_table("free_agency_draws")
    op.drop_column("trade_proposals", "executed_at")
    op.drop_constraint(
        "fk_trade_proposals_approved_by_manager_id", "trade_proposals", type_="foreignkey"
    )
    op.drop_column("trade_proposals", "approved_by_manager_id")
    op.drop_column("trade_proposals", "required_approver_role")
    op.drop_column("trade_proposals", "approval_status")
