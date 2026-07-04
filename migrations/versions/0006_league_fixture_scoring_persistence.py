"""create league fixture scoring persistence tables

Revision ID: 0006_fixture_scoring
Revises: 0005_team_selection_persistence
Create Date: 2026-07-04 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_fixture_scoring"
down_revision: str | None = "0005_team_selection_persistence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ID = sa.String(length=64)

TABLES = (
    "cdl_fixtures",
    "epl_fixtures",
    "fixture_results",
    "fixture_scoring_snapshots",
    "league_table_snapshots",
    "knockout_matches",
    "head_to_head_records",
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
