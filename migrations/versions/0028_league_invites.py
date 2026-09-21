"""Add revocable league invite links."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0028_league_invites"
down_revision: str | None = "0027_theme_colour_variants"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "league_invites",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "league_id",
            sa.String(length=64),
            sa.ForeignKey("leagues.id"),
            nullable=False,
        ),
        sa.Column(
            "created_by_user_id",
            sa.String(length=64),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_league_invites_league_id",
        "league_invites",
        ["league_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_league_invites_league_id", table_name="league_invites")
    op.drop_table("league_invites")
