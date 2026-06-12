"""create core league and FPL cache tables

Revision ID: 0003_core_league_fpl_cache
Revises: 0002_auth_preferences
Create Date: 2026-06-11 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_core_league_fpl_cache"
down_revision: str | None = "0002_auth_preferences"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "leagues",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False, unique=True),
    )
    op.create_table(
        "seasons",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "league_id",
            sa.String(length=64),
            sa.ForeignKey("leagues.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("start_gameweek", sa.Integer(), nullable=False),
        sa.Column("end_gameweek", sa.Integer(), nullable=False),
    )
    op.create_table(
        "managers",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=False),
    )
    op.create_table(
        "draft_teams",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "league_id",
            sa.String(length=64),
            sa.ForeignKey("leagues.id"),
            nullable=False,
        ),
        sa.Column("manager_id", sa.String(length=64), sa.ForeignKey("managers.id"), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
    )
    op.create_table(
        "league_memberships",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "league_id",
            sa.String(length=64),
            sa.ForeignKey("leagues.id"),
            nullable=False,
        ),
        sa.Column(
            "manager_id",
            sa.String(length=64),
            sa.ForeignKey("managers.id"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=64), nullable=False),
    )
    op.create_table(
        "league_permissions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "membership_id",
            sa.String(length=64),
            sa.ForeignKey("league_memberships.id"),
            nullable=False,
        ),
        sa.Column("permission", sa.String(length=128), nullable=False),
    )
    op.create_table(
        "fpl_positions",
        sa.Column("id", sa.String(length=16), primary_key=True),
        sa.Column("singular_name", sa.String(length=64), nullable=False),
        sa.Column("plural_name", sa.String(length=64), nullable=False),
    )
    op.create_table(
        "epl_teams",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("short_name", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
    )
    op.create_table(
        "fpl_players",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("first_name", sa.String(length=255), nullable=False),
        sa.Column("second_name", sa.String(length=255), nullable=False),
        sa.Column("web_name", sa.String(length=255), nullable=False),
        sa.Column(
            "position_id",
            sa.String(length=16),
            sa.ForeignKey("fpl_positions.id"),
            nullable=False,
        ),
        sa.Column("team_id", sa.String(length=64), sa.ForeignKey("epl_teams.id"), nullable=False),
    )
    op.create_table(
        "fpl_player_values",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "player_id",
            sa.String(length=64),
            sa.ForeignKey("fpl_players.id"),
            nullable=False,
        ),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
    )
    op.create_table(
        "fpl_player_availability",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "player_id",
            sa.String(length=64),
            sa.ForeignKey("fpl_players.id"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("news", sa.String(length=512), nullable=False, server_default=""),
    )
    op.create_table(
        "fpl_cache_freshness",
        sa.Column("resource", sa.String(length=128), primary_key=True),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("fpl_cache_freshness")
    op.drop_table("fpl_player_availability")
    op.drop_table("fpl_player_values")
    op.drop_table("fpl_players")
    op.drop_table("epl_teams")
    op.drop_table("fpl_positions")
    op.drop_table("league_permissions")
    op.drop_table("league_memberships")
    op.drop_table("draft_teams")
    op.drop_table("managers")
    op.drop_table("seasons")
    op.drop_table("leagues")
