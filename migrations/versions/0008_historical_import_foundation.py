"""create historical import foundation tables

Revision ID: 0008_historical_import
Revises: 0007_dashboard_fdr
Create Date: 2026-07-27 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_historical_import"
down_revision: str | None = "0007_dashboard_fdr"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ID = sa.String(length=64)
SOURCE_ID = sa.String(length=255)


def upgrade() -> None:
    op.create_table(
        "historical_import_batches",
        sa.Column("id", ID, primary_key=True),
        sa.Column("contract_version", sa.String(length=64), nullable=False),
        sa.Column("source_name", sa.String(length=255), nullable=False),
        sa.Column("source_sha256", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column(
            "dry_run",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("audit_json", sa.JSON(), nullable=False),
        sa.UniqueConstraint(
            "source_sha256",
            "contract_version",
            name="uq_import_batch_source_contract",
        ),
    )
    op.create_table(
        "historical_source_payloads",
        sa.Column("id", ID, primary_key=True),
        sa.Column("batch_id", ID, nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("source_id", SOURCE_ID, nullable=False),
        sa.Column("payload_sha256", sa.String(length=64), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["historical_import_batches.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "batch_id",
            "source_type",
            "source_id",
            name="uq_source_payload_identity",
        ),
    )
    op.create_table(
        "historical_source_mappings",
        sa.Column("id", ID, primary_key=True),
        sa.Column("batch_id", ID, nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("source_id", SOURCE_ID, nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", ID, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["historical_import_batches.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "source_type",
            "source_id",
            "target_type",
            name="uq_source_mapping_identity",
        ),
    )
    op.create_table(
        "historical_import_review_items",
        sa.Column("id", ID, primary_key=True),
        sa.Column("batch_id", ID, nullable=False),
        sa.Column("source_payload_id", ID, nullable=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("details_json", sa.JSON(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["historical_import_batches.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_payload_id"],
            ["historical_source_payloads.id"],
            ondelete="SET NULL",
        ),
    )
    op.create_table(
        "historical_import_conflicts",
        sa.Column("id", ID, primary_key=True),
        sa.Column("batch_id", ID, nullable=False),
        sa.Column("source_payload_id", ID, nullable=True),
        sa.Column("conflict_type", sa.String(length=64), nullable=False),
        sa.Column("existing_json", sa.JSON(), nullable=False),
        sa.Column("incoming_json", sa.JSON(), nullable=False),
        sa.Column("resolution", sa.String(length=32), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["historical_import_batches.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_payload_id"],
            ["historical_source_payloads.id"],
            ondelete="SET NULL",
        ),
    )

    op.create_index(
        "ix_source_payload_batch",
        "historical_source_payloads",
        ["batch_id"],
    )
    op.create_index(
        "ix_source_mapping_batch",
        "historical_source_mappings",
        ["batch_id"],
    )
    op.create_index(
        "ix_import_review_batch",
        "historical_import_review_items",
        ["batch_id"],
    )
    op.create_index(
        "ix_import_conflict_batch",
        "historical_import_conflicts",
        ["batch_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_import_conflict_batch",
        table_name="historical_import_conflicts",
    )
    op.drop_index(
        "ix_import_review_batch",
        table_name="historical_import_review_items",
    )
    op.drop_index(
        "ix_source_mapping_batch",
        table_name="historical_source_mappings",
    )
    op.drop_index(
        "ix_source_payload_batch",
        table_name="historical_source_payloads",
    )
    op.drop_table("historical_import_conflicts")
    op.drop_table("historical_import_review_items")
    op.drop_table("historical_source_mappings")
    op.drop_table("historical_source_payloads")
    op.drop_table("historical_import_batches")
