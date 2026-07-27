"""PostgreSQL table metadata matching migration 0008 import storage."""

from sqlalchemy import JSON, Column, DateTime, MetaData, String, Table

metadata = MetaData()


def _import_table(name: str) -> Table:
    """Match the generic payload schema created by migration 0008."""
    return Table(
        name,
        metadata,
        Column("id", String(64), primary_key=True),
        Column("payload_json", JSON(), nullable=False),
        Column("created_at", DateTime(timezone=True), nullable=True),
    )


import_batches_table = _import_table("import_batches")
import_source_mappings_table = _import_table("import_source_mappings")
import_source_payloads_table = _import_table("import_source_payloads")
import_review_items_table = _import_table("import_review_items")
import_conflicts_table = _import_table("import_conflicts")

HISTORICAL_IMPORT_PERSISTENCE_TABLES = (
    import_batches_table,
    import_source_mappings_table,
    import_source_payloads_table,
    import_review_items_table,
    import_conflicts_table,
)
