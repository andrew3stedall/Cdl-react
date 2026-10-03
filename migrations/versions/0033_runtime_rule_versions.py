"""Persist immutable season rule snapshots and pin locked lineups/results.

Revision ID: 0033_runtime_rule_versions
Revises: 0032_persistent_live_draft
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0033_runtime_rule_versions"
down_revision: str | None = "0032_persistent_live_draft"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "league_season_rule_versions",
        sa.Column("id", sa.String(length=96), primary_key=True),
        sa.Column("season_id", sa.String(length=64), sa.ForeignKey("seasons.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("source_decision_version", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("season_id", "version", name="uq_rule_version_season_number"),
    )
    op.execute(
        """
        CREATE FUNCTION reject_rule_version_mutation() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'league season rule versions are immutable';
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_rule_versions_immutable
        BEFORE UPDATE OR DELETE ON league_season_rule_versions
        FOR EACH ROW EXECUTE FUNCTION reject_rule_version_mutation()
        """
    )
    op.create_table(
        "league_season_rule_state",
        sa.Column("season_id", sa.String(length=64), sa.ForeignKey("seasons.id"), primary_key=True),
        sa.Column(
            "active_version_id",
            sa.String(length=96),
            sa.ForeignKey("league_season_rule_versions.id"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.add_column(
        "team_selection_lineup_slots",
        sa.Column(
            "rule_version_id",
            sa.String(length=96),
            sa.ForeignKey("league_season_rule_versions.id"),
            nullable=True,
        ),
    )

    # This first snapshot records only accepted, currently implemented rules.
    # Unresolved bonus, captain-absence, and playoff-tie policies are marked as
    # unavailable rather than assigned guessed values.
    # Execute the immutable JSON literal as driver SQL: SQLAlchemy text()
    # otherwise interprets JSON colons followed by numbers as bind parameters.
    op.get_bind().exec_driver_sql(
        """
        INSERT INTO league_season_rule_versions
            (id, season_id, version, config_json, source_decision_version, created_at)
        SELECT
            'rules-' || s.id || '-v1', s.id, 1,
            '{"schema_version":1,"squad":{"size":20,"position_limits":{"GKP":{"min":2,"max":3},"DEF":{"min":4,"max":10},"MID":{"min":5,"max":10},"FWD":{"min":2,"max":4}}},"lineup":{"starters":11,"starter_position_limits":{"GKP":{"min":1,"max":1},"DEF":{"min":3,"max":5},"MID":{"min":2,"max":5},"FWD":{"min":1,"max":3}},"captain_and_vice_must_start":true,"normal_substitution_minutes":0,"substitutions_preserve_formation":true,"reserves_score":false},"transfers":{"cooling_off_gameweeks":4},"scoring":{"league_points":{"win":3,"draw":1,"loss":0},"chips":{"triple_captain_multiplier":3,"dual_captain_multiplier":2,"auto_captain_multiplier":2,"bench_boost_includes_bench":true,"best_xi_count":11,"best_xi_ignores_position":true},"bonus_policy":"unconfigured_pending_494","captain_absence_policy":"unconfigured_pending_499","playoff_tie_policy":"unconfigured_pending_496"}}'::json,
            'decision-log-2026-06-02', CURRENT_TIMESTAMP
        FROM seasons AS s
        WHERE s.id = 'season-cdl-2026-27'
        """
    )
    op.execute(
        """
        INSERT INTO league_season_rule_state (season_id, active_version_id, updated_at)
        SELECT id, 'rules-' || id || '-v1', CURRENT_TIMESTAMP
        FROM seasons WHERE id = 'season-cdl-2026-27'
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER trg_rule_versions_immutable ON league_season_rule_versions")
    op.execute("DROP FUNCTION reject_rule_version_mutation()")
    op.drop_column("team_selection_lineup_slots", "rule_version_id")
    op.drop_table("league_season_rule_state")
    op.drop_table("league_season_rule_versions")
