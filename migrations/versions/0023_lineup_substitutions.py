"""persist automatic substitutions applied to completed fixture scores

Revision ID: 0023_lineup_substitutions
Revises: 0022_team_selection_lock_owner
Create Date: 2026-09-02 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023_lineup_substitutions"
down_revision: str | None = "0022_team_selection_lock_owner"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lineup_substitutions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "season_id",
            sa.String(length=64),
            sa.ForeignKey("seasons.id"),
            nullable=False,
        ),
        sa.Column(
            "draft_team_id",
            sa.String(length=64),
            sa.ForeignKey("draft_teams.id"),
            nullable=False,
        ),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("fixture_id", sa.String(length=64), nullable=False),
        sa.Column("snapshot_id", sa.String(length=64), nullable=False),
        sa.Column(
            "starter_player_id",
            sa.String(length=64),
            sa.ForeignKey("fpl_players.id"),
            nullable=False,
        ),
        sa.Column(
            "substitute_player_id",
            sa.String(length=64),
            sa.ForeignKey("fpl_players.id"),
            nullable=False,
        ),
        sa.Column("starter_slot_order", sa.Integer(), nullable=False),
        sa.Column("bench_order", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=64), nullable=False),
        sa.Column("formation_preserved", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_lineup_substitutions_fixture",
        "lineup_substitutions",
        ["season_id", "fixture_id", "draft_team_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_lineup_substitutions_fixture",
        table_name="lineup_substitutions",
    )
    op.drop_table("lineup_substitutions")
