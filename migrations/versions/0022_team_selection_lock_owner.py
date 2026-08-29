"""scope team-selection deadline locks to their draft team

Revision ID: 0022_team_selection_lock_owner
Revises: 0021_player_custom_palettes
Create Date: 2026-08-29 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022_team_selection_lock_owner"
down_revision: str | None = "0021_player_custom_palettes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "team_selection_fixture_locks",
        sa.Column(
            "draft_team_id",
            sa.String(length=64),
            sa.ForeignKey("draft_teams.id"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_team_selection_fixture_locks_scope",
        "team_selection_fixture_locks",
        ["season_id", "draft_team_id", "gameweek"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_team_selection_fixture_locks_scope",
        table_name="team_selection_fixture_locks",
    )
    op.drop_column("team_selection_fixture_locks", "draft_team_id")
