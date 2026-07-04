"""PostgreSQL table metadata for dashboard and fixture difficulty production data."""

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    text,
)

metadata = MetaData()

dashboard_definitions_table = Table(
    "dashboard_definitions",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("title", String(255), nullable=False),
    Column("definition_json", JSON(), nullable=False, server_default=text("'{}'")),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

dashboard_metric_catalog_table = Table(
    "dashboard_metric_catalog",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("label", String(255), nullable=False),
    Column("aggregation", String(64), nullable=False),
    Column("format", String(64), nullable=False),
    Column("description", String(255), nullable=False),
)

dashboard_aggregate_snapshots_table = Table(
    "dashboard_aggregate_snapshots",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("dashboard_id", String(64), ForeignKey("dashboard_definitions.id"), nullable=False),
    Column("metric_id", String(64), ForeignKey("dashboard_metric_catalog.id"), nullable=False),
    Column("dimension_id", String(64), nullable=False),
    Column("dimension_value", String(255), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("value", Numeric(12, 4), nullable=False),
    Column("calculated_at", DateTime(timezone=True), nullable=False),
)

fdr_ratings_table = Table(
    "fdr_ratings",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("team_id", String(64), ForeignKey("epl_teams.id"), nullable=False),
    Column("opponent_team_id", String(64), ForeignKey("epl_teams.id"), nullable=False),
    Column("gameweek", Integer(), nullable=False),
    Column("view", String(64), nullable=False),
    Column("venue", String(64), nullable=False),
    Column("rating", Integer(), nullable=False),
    Column("band", String(64), nullable=False),
    Column("calculated_at", DateTime(timezone=True), nullable=False),
)

fdr_calculation_inputs_table = Table(
    "fdr_calculation_inputs",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("season_id", String(64), ForeignKey("seasons.id"), nullable=False),
    Column("source", String(64), nullable=False),
    Column("input_json", JSON(), nullable=False, server_default=text("'{}'")),
    Column("captured_at", DateTime(timezone=True), nullable=False),
)

DASHBOARD_FDR_PERSISTENCE_TABLES = (
    dashboard_definitions_table,
    dashboard_metric_catalog_table,
    dashboard_aggregate_snapshots_table,
    fdr_ratings_table,
    fdr_calculation_inputs_table,
)
