"""PostgreSQL table metadata for historical CDL import tooling."""

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, MetaData, String, Table, text

metadata = MetaData()

import_batches_table = Table(
    "import_batches",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("source_system", String(64), nullable=False),
    Column("status", String(64), nullable=False),
    Column("started_at", DateTime(timezone=True), nullable=False),
    Column("completed_at", DateTime(timezone=True), nullable=True),
    Column("notes", String(512), nullable=False),
)

import_source_mappings_table = Table(
    "import_source_mappings",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("batch_id", String(64), ForeignKey("import_batches.id"), nullable=False),
    Column("source_system", String(64), nullable=False),
    Column("source_type", String(64), nullable=False),
    Column("source_id", String(255), nullable=False),
    Column("target_table", String(64), nullable=False),
    Column("target_id", String(64), nullable=False),
    Column("confidence", Integer(), nullable=False),
)

import_source_payloads_table = Table(
    "import_source_payloads",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("batch_id", String(64), ForeignKey("import_batches.id"), nullable=False),
    Column("source_system", String(64), nullable=False),
    Column("source_type", String(64), nullable=False),
    Column("source_id", String(255), nullable=False),
    Column("payload_json", JSON(), nullable=False, server_default=text("'{}'")),
    Column("archived_at", DateTime(timezone=True), nullable=False),
)

import_review_items_table = Table(
    "import_review_items",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("batch_id", String(64), ForeignKey("import_batches.id"), nullable=False),
    Column("subject_type", String(64), nullable=False),
    Column("subject_id", String(64), nullable=False),
    Column("reason", String(512), nullable=False),
    Column("status", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("resolved_at", DateTime(timezone=True), nullable=True),
)

import_conflicts_table = Table(
    "import_conflicts",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("batch_id", String(64), ForeignKey("import_batches.id"), nullable=False),
    Column("mapping_id", String(64), ForeignKey("import_source_mappings.id"), nullable=True),
    Column("conflict_type", String(64), nullable=False),
    Column("message", String(512), nullable=False),
    Column("status", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("resolved_at", DateTime(timezone=True), nullable=True),
)

HISTORICAL_IMPORT_PERSISTENCE_TABLES = (
    import_batches_table,
    import_source_mappings_table,
    import_source_payloads_table,
    import_review_items_table,
    import_conflicts_table,
)
