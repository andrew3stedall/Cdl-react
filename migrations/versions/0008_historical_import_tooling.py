"""create historical import tooling tables

Revision ID: 0008_historical_import_tooling
Revises: 0007_dashboard_fdr_production_data
Create Date: 2026-07-04 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_historical_import_tooling"
down_revision: str | None = "0007_dashboard_fdr_production_data"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ID = sa.String(length=64)
SHORT_TEXT = sa.String(length=64)
TEXT = sa.String(length=255)
NOTE_TEXT = sa.String(length=512)


def upgrade() -> None:
    op.create_table(
        "import_batches",
        sa.Column("id", ID, primary_key=True),
        sa.Column("source_system", SHORT_TEXT, nullable=False),
        sa.Column("status", SHORT_TEXT, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", NOTE_TEXT, nullable=False, server_default=""),
    )
    op.create_table(
        "import_source_mappings",
        sa.Column("id", ID, primary_key=True),
        sa.Column("batch_id", ID, nullable=False),
        sa.Column("source_system", SHORT_TEXT, nullable=False),
        sa.Column("source_type", SHORT_TEXT, nullable=False),
        sa.Column("source_id", TEXT, nullable=False),
        sa.Column("target_table", SHORT_TEXT, nullable=False),
        sa.Column("target_id", ID, nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=False, server_default="100"),
    )
    op.create_table(
        "import_source_payloads",
        sa.Column("id", ID, primary_key=True),
        sa.Column("batch_id", ID, nullable=False),
        sa.Column("source_system", SHORT_TEXT, nullable=False),
        sa.Column("source_type", SHORT_TEXT, nullable=False),
        sa.Column("source_id", TEXT, nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "import_review_items",
        sa.Column("id", ID, primary_key=True),
        sa.Column("batch_id", ID, nullable=False),
        sa.Column("subject_type", SHORT_TEXT, nullable=False),
        sa.Column("subject_id", ID, nullable=False),
        sa.Column("reason", NOTE_TEXT, nullable=False),
        sa.Column("status", SHORT_TEXT, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "import_conflicts",
        sa.Column("id", ID, primary_key=True),
        sa.Column("batch_id", ID, nullable=False),
        sa.Column("mapping_id", ID, nullable=True),
        sa.Column("conflict_type", SHORT_TEXT, nullable=False),
        sa.Column("message", NOTE_TEXT, nullable=False),
        sa.Column("status", SHORT_TEXT, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("import_conflicts")
    op.drop_table("import_review_items")
    op.drop_table("import_source_payloads")
    op.drop_table("import_source_mappings")
    op.drop_table("import_batches")
