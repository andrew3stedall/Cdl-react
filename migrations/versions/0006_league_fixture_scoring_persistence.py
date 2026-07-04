"""create league fixture scoring persistence tables

Revision ID: 0006_league_fixture_scoring_persistence
Revises: 0005_team_selection_persistence
Create Date: 2026-07-04 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_league_fixture_scoring_persistence"
down_revision: str | None = "0005_team_selection_persistence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ID = sa.String(length=64)
SHORT_TEXT = sa.String(length=64)
NOTE_TEXT = sa.String(length=512)


def upgrade() -> None:
    op.create_table(
        "cdl_fixtures",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("home_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("away_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("status", SHORT_TEXT, nullable=False),
        sa.Column("round_label", SHORT_TEXT, nullable=False),
        sa.Column("kickoff_label", SHORT_TEXT, nullable=False, server_default=""),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_next", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("detail_available", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "epl_fixtures",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("home_team_id", ID, sa.ForeignKey("epl_teams.id"), nullable=False),
        sa.Column("away_team_id", ID, sa.ForeignKey("epl_teams.id"), nullable=False),
        sa.Column("kickoff_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", SHORT_TEXT, nullable=False),
    )
    op.create_table(
        "fixture_results",
        sa.Column("id", ID, primary_key=True),
        sa.Column("fixture_id", ID, sa.ForeignKey("cdl_fixtures.id"), nullable=False),
        sa.Column("home_score", sa.Integer(), nullable=True),
        sa.Column("away_score", sa.Integer(), nullable=True),
        sa.Column("outcome", SHORT_TEXT, nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "fixture_scoring_snapshots",
        sa.Column("id", ID, primary_key=True),
        sa.Column("fixture_id", ID, sa.ForeignKey("cdl_fixtures.id"), nullable=False),
        sa.Column("draft_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("bonus_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("chips_played_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "league_table_snapshots",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("draft_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("played", sa.Integer(), nullable=False),
        sa.Column("wins", sa.Integer(), nullable=False),
        sa.Column("draws", sa.Integer(), nullable=False),
        sa.Column("losses", sa.Integer(), nullable=False),
        sa.Column("points_for", sa.Integer(), nullable=False),
        sa.Column("points_against", sa.Integer(), nullable=False),
        sa.Column("league_points", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "knockout_matches",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("fixture_id", ID, sa.ForeignKey("cdl_fixtures.id"), nullable=False),
        sa.Column("round_label", SHORT_TEXT, nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("winner_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=True),
    )
    op.create_table(
        "head_to_head_records",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("opponent_team_id", ID, sa.ForeignKey("draft_teams.id"), nullable=False),
        sa.Column("played", sa.Integer(), nullable=False),
        sa.Column("wins", sa.Integer(), nullable=False),
        sa.Column("draws", sa.Integer(), nullable=False),
        sa.Column("losses", sa.Integer(), nullable=False),
        sa.Column("points_for", sa.Integer(), nullable=False),
        sa.Column("points_against", sa.Integer(), nullable=False),
        sa.Column("notes", NOTE_TEXT, nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_table("head_to_head_records")
    op.drop_table("knockout_matches")
    op.drop_table("league_table_snapshots")
    op.drop_table("fixture_scoring_snapshots")
    op.drop_table("fixture_results")
    op.drop_table("epl_fixtures")
    op.drop_table("cdl_fixtures")
