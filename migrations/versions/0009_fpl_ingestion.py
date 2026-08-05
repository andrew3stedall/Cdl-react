"""add official FPL ingestion cache and audit tables

Revision ID: 0009_fpl_ingestion
Revises: 0008_import_tooling
Create Date: 2026-08-05 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_fpl_ingestion"
down_revision: str | None = "0008_import_tooling"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "fpl_gameweeks",
        sa.Column("id", sa.String(length=16), primary_key=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("deadline_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_previous", sa.Boolean(), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("is_next", sa.Boolean(), nullable=False),
        sa.Column("finished", sa.Boolean(), nullable=False),
        sa.Column("data_checked", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "fpl_fixtures",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("gameweek", sa.Integer(), nullable=True),
        sa.Column(
            "home_team_id",
            sa.String(length=64),
            sa.ForeignKey("epl_teams.id"),
            nullable=False,
        ),
        sa.Column(
            "away_team_id",
            sa.String(length=64),
            sa.ForeignKey("epl_teams.id"),
            nullable=False,
        ),
        sa.Column("kickoff_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started", sa.Boolean(), nullable=False),
        sa.Column("finished", sa.Boolean(), nullable=False),
        sa.Column("home_difficulty", sa.Integer(), nullable=True),
        sa.Column("away_difficulty", sa.Integer(), nullable=True),
        sa.Column("home_score", sa.Integer(), nullable=True),
        sa.Column("away_score", sa.Integer(), nullable=True),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_fpl_fixtures_gameweek", "fpl_fixtures", ["gameweek"])
    op.create_index("ix_fpl_fixtures_kickoff_time", "fpl_fixtures", ["kickoff_time"])
    op.create_table(
        "external_payload_cache",
        sa.Column("resource", sa.String(length=128), primary_key=True),
        sa.Column("endpoint", sa.String(length=512), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("response_sha256", sa.String(length=64), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "external_fetch_log",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("resource", sa.String(length=128), nullable=False),
        sa.Column("endpoint", sa.String(length=512), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("response_sha256", sa.String(length=64), nullable=True),
        sa.Column("record_count", sa.Integer(), nullable=False),
        sa.Column("error", sa.String(length=512), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_external_fetch_log_resource_fetched_at",
        "external_fetch_log",
        ["resource", "fetched_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_external_fetch_log_resource_fetched_at",
        table_name="external_fetch_log",
    )
    op.drop_table("external_fetch_log")
    op.drop_table("external_payload_cache")
    op.drop_index("ix_fpl_fixtures_kickoff_time", table_name="fpl_fixtures")
    op.drop_index("ix_fpl_fixtures_gameweek", table_name="fpl_fixtures")
    op.drop_table("fpl_fixtures")
    op.drop_table("fpl_gameweeks")
