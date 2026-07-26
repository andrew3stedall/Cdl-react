"""PostgreSQL table metadata matching migration 0007 payload storage."""

from sqlalchemy import JSON, Column, DateTime, MetaData, String, Table

metadata = MetaData()


def _persistence_table(name: str) -> Table:
    """Match the generic payload schema created by migration 0007."""
    return Table(
        name,
        metadata,
        Column("id", String(64), primary_key=True),
        Column("payload_json", JSON(), nullable=False),
        Column("created_at", DateTime(timezone=True), nullable=True),
    )


dashboard_definitions_table = _persistence_table("dashboard_definitions")
dashboard_metric_catalog_table = _persistence_table("dashboard_metric_catalog")
dashboard_aggregate_snapshots_table = _persistence_table("dashboard_aggregate_snapshots")
fdr_ratings_table = _persistence_table("fdr_ratings")
fdr_calculation_inputs_table = _persistence_table("fdr_calculation_inputs")

DASHBOARD_FDR_PERSISTENCE_TABLES = (
    dashboard_definitions_table,
    dashboard_metric_catalog_table,
    dashboard_aggregate_snapshots_table,
    fdr_ratings_table,
    fdr_calculation_inputs_table,
)
