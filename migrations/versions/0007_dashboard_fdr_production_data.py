"""create dashboard and fdr production data tables

Revision ID: 0007_dashboard_fdr_production_data
Revises: 0006_league_fixture_scoring_persistence
Create Date: 2026-07-04 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_dashboard_fdr_production_data"
down_revision: str | None = "0006_league_fixture_scoring_persistence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ID = sa.String(length=64)
TEXT = sa.String(length=255)
SHORT_TEXT = sa.String(length=64)


def upgrade() -> None:
    op.create_table(
        "dashboard_definitions",
        sa.Column("id", ID, primary_key=True),
        sa.Column("title", TEXT, nullable=False),
        sa.Column("definition_json", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "dashboard_metric_catalog",
        sa.Column("id", ID, primary_key=True),
        sa.Column("label", TEXT, nullable=False),
        sa.Column("aggregation", SHORT_TEXT, nullable=False),
        sa.Column("format", SHORT_TEXT, nullable=False),
        sa.Column("description", TEXT, nullable=False, server_default=""),
    )
    op.create_table(
        "dashboard_aggregate_snapshots",
        sa.Column("id", ID, primary_key=True),
        sa.Column("dashboard_id", ID, nullable=False),
        sa.Column("metric_id", ID, nullable=False),
        sa.Column("dimension_id", SHORT_TEXT, nullable=False),
        sa.Column("dimension_value", TEXT, nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("value", sa.Numeric(12, 4), nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "fdr_ratings",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, nullable=False),
        sa.Column("team_id", ID, nullable=False),
        sa.Column("opponent_team_id", ID, nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("view", SHORT_TEXT, nullable=False),
        sa.Column("venue", SHORT_TEXT, nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("band", SHORT_TEXT, nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "fdr_calculation_inputs",
        sa.Column("id", ID, primary_key=True),
        sa.Column("season_id", ID, nullable=False),
        sa.Column("source", SHORT_TEXT, nullable=False),
        sa.Column("input_json", sa.JSON(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("fdr_calculation_inputs")
    op.drop_table("fdr_ratings")
    op.drop_table("dashboard_aggregate_snapshots")
    op.drop_table("dashboard_metric_catalog")
    op.drop_table("dashboard_definitions")
