"""Bind league invite links to one draft team."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0029_targeted_league_invites"
down_revision: str | None = "0028_league_invites"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "league_invites",
        sa.Column("team_id", sa.String(length=64), nullable=True),
    )
    op.create_foreign_key(
        "fk_league_invites_team_id",
        "league_invites",
        "draft_teams",
        ["team_id"],
        ["id"],
    )
    op.create_index(
        "ix_league_invites_team_id",
        "league_invites",
        ["team_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_league_invites_team_id", table_name="league_invites")
    op.drop_constraint("fk_league_invites_team_id", "league_invites", type_="foreignkey")
    op.drop_column("league_invites", "team_id")
