"""create team selection persistence tables

Revision ID: 0005_team_selection_persistence
Revises: 0004_squad_transfer_persistence
Create Date: 2026-06-13 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_team_selection_persistence"
down_revision: str | None = "0004_squad_transfer_persistence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


ID = sa.String(length=64)
SHORT_TEXT = sa.String(length=64)
NOTE_TEXT = sa.String(length=512)


def upgrade() -> None:
    op.create_table(
        "team_selection_lineup_slots",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("draft_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("player_id", ID, sa.ForeignKey("fpl_players.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("slot", SHORT_TEXT, nullable=False),
        sa.Column("slot_order", sa.Integer(), nullable=False),
        sa.Column("is_captain", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "is_vice_captain",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "team_selection_chips",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("draft_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("chip_id", SHORT_TEXT, nullable=False),
        sa.Column("status", SHORT_TEXT, nullable=False),
        sa.Column("active_gameweek", sa.Integer(), nullable=True),
        sa.Column("used_gameweek", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "team_selection_fixture_locks",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("fixture_id", ID, nullable=False),
        sa.Column("fixture_type", SHORT_TEXT, nullable=False),
        sa.Column("lock_scope", SHORT_TEXT, nullable=False),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", NOTE_TEXT, nullable=False, server_default=""),
    )
    op.create_table(
        "team_selection_audit_events",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("draft_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("action", SHORT_TEXT, nullable=False),
        sa.Column("subject_type", SHORT_TEXT, nullable=False),
        sa.Column("subject_id", ID, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("team_selection_audit_events")
    op.drop_table("team_selection_fixture_locks")
    op.drop_table("team_selection_chips")
    op.drop_table("team_selection_lineup_slots")
