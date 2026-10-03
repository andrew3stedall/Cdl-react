"""Promote the configured staging commissioner in the current league only.

Revision ID: 0035_commissioner_membership
Revises: 0034_private_scouting
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0035_commissioner_membership"
down_revision: str | None = "0034_private_scouting"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CURRENT_LEAGUE_ID = "league-cdl-2026-27"
COMMISSIONER_EMAIL = "andrew3stedall@gmail.com"


def upgrade() -> None:
    # Restrict the capability to the configured canonical reviewer identity,
    # whose persisted user record explicitly has commissioner/admin authority.
    # Only promote a manager membership; do not rewrite another scoped role.
    op.execute(
        sa.text(
            """
        UPDATE league_memberships AS membership
        SET role = 'commissioner'
        FROM managers AS manager
        JOIN users AS app_user ON app_user.id = manager.user_id
        WHERE membership.manager_id = manager.id
          AND membership.league_id = :league_id
          AND membership.role = 'manager'
          AND lower(app_user.email) = :commissioner_email
          AND (
              app_user.roles::jsonb @> '["commissioner"]'::jsonb
              OR app_user.roles::jsonb @> '["admin"]'::jsonb
        )
        """
        ).bindparams(league_id=CURRENT_LEAGUE_ID, commissioner_email=COMMISSIONER_EMAIL)
    )


def downgrade() -> None:
    # The seed will restore the scoped commissioner role on its next run.
    # Leave membership state intact during code rollback to avoid silently
    # removing an authorization assignment that may have been reviewed.
    pass
