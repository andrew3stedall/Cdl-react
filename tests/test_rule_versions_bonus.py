from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from cdl_api.repositories.rule_versions import (
    CURRENT_RULE_CONFIG,
    active_rule_version_id,
    ensure_current_rule_version,
    immutable_rule_config,
    league_bonus_points,
    league_season_rule_state_table,
    league_season_rule_versions_table,
    metadata,
)


def test_league_bonus_points_uses_exact_double_and_triple_thresholds() -> None:
    assert league_bonus_points(99, 50, CURRENT_RULE_CONFIG) == 0
    assert league_bonus_points(100, 50, CURRENT_RULE_CONFIG) == 1
    assert league_bonus_points(149, 50, CURRENT_RULE_CONFIG) == 1
    assert league_bonus_points(150, 50, CURRENT_RULE_CONFIG) == 2
    assert league_bonus_points(500, 50, CURRENT_RULE_CONFIG) == 2


def test_league_bonus_points_never_awards_against_non_positive_score() -> None:
    assert league_bonus_points(50, 0, CURRENT_RULE_CONFIG) == 0
    assert league_bonus_points(50, -1, CURRENT_RULE_CONFIG) == 0
    assert league_bonus_points(0, 0, CURRENT_RULE_CONFIG) == 0


def test_corrected_score_recalculates_bonus_from_final_score() -> None:
    assert league_bonus_points(120, 60, CURRENT_RULE_CONFIG) == 1
    assert league_bonus_points(180, 60, CURRENT_RULE_CONFIG) == 2
    assert league_bonus_points(119, 60, CURRENT_RULE_CONFIG) == 0


def test_current_rule_version_creates_v2_and_activates_it_without_rewriting_v1() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    metadata.create_all(engine)
    season_id = "season-test"

    with Session(engine) as session:
        version_id = ensure_current_rule_version(session, season_id)
        session.commit()

    assert version_id == "rules-season-test-v2"
    with Session(engine) as session:
        assert active_rule_version_id(session, season_id) == version_id
        rows = session.execute(
            select(
                league_season_rule_versions_table.c.version,
                league_season_rule_versions_table.c.source_decision_version,
            ).order_by(league_season_rule_versions_table.c.version)
        ).all()
        assert rows == [
            (1, "decision-log-2026-06-02"),
            (2, "issue-494-2026-10-08"),
        ]
        config = immutable_rule_config(session, version_id)
        assert config is not None
        scoring = config["scoring"]
        assert scoring["bonus_policy"]["double_bonus"] == 1
        assert scoring["bonus_policy"]["triple_bonus"] == 2
        assert session.execute(select(league_season_rule_state_table.c.active_version_id)).scalar_one() == version_id
