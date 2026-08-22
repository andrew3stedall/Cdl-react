"""persist provisional completion state for official FPL fixtures

Revision ID: 0014_fpl_provisional_fixture
Revises: 0013_fdr_display_mode
Create Date: 2026-08-22 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014_fpl_provisional_fixture"
down_revision: str | None = "0013_fdr_display_mode"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "fpl_fixtures",
        sa.Column(
            "finished_provisional",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("fpl_fixtures", "finished_provisional")
