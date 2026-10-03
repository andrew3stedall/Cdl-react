"""Persist private player watchlists and notes."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0034_private_scouting"
down_revision: str | None = "0033_runtime_rule_versions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "private_player_scouting",
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "player_id",
            sa.String(64),
            sa.ForeignKey("fpl_players.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("watchlisted", sa.Boolean(), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("private_player_scouting")
