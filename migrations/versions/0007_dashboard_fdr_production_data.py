"""create dashboard and fdr production data tables

Revision ID: 0007_dashboard_fdr
Revises: 0006_fixture_scoring
Create Date: 2026-07-04 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_dashboard_fdr"
down_revision: str | None = "0006_fixture_scoring"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ID = sa.String(length=64)

TABLES = (
    "dashboard_definitions",
    "dashboard_metric_catalog",
    "dashboard_aggregate_snapshots",
    "fdr_ratings",
    "fdr_calculation_inputs",
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
