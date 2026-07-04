"""create historical import tooling tables

Revision ID: 0008_import_tooling
Revises: 0007_dashboard_fdr
Create Date: 2026-07-04 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_import_tooling"
down_revision: str | None = "0007_dashboard_fdr"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ID = sa.String(length=64)

TABLES = (
    "import_batches",
    "import_source_mappings",
    "import_source_payloads",
    "import_review_items",
    "import_conflicts",
)


def upgrade() -> None:
    for table_name in TABLES:
        op.create_table(
            table_name,
            sa.Column("id", ID, primary_key=True),
            sa.Column("payload_json", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    for table_name in reversed(TABLES):
        op.drop_table(table_name)
