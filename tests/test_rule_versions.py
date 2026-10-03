from datetime import UTC, datetime

from sqlalchemy import create_engine, insert, select

from cdl_api.repositories.rule_versions import (
    active_rule_version_id,
    immutable_rule_config,
    league_season_rule_state_table,
    league_season_rule_versions_table,
)


def test_active_rule_version_resolves_immutable_snapshot_config() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    league_season_rule_versions_table.create(engine)
    league_season_rule_state_table.create(engine)
    now = datetime.now(UTC)
    config = {
        "schema_version": 1,
        "squad": {"size": 20},
        "scoring": {"bonus_policy": "unconfigured_pending_494"},
    }
    with engine.begin() as connection:
        connection.execute(
            insert(league_season_rule_versions_table).values(
                id="rules-season-v1",
                season_id="season-one",
                version=1,
                config_json=config,
                source_decision_version="decision-log-2026-06-02",
                created_at=now,
            )
        )
        connection.execute(
            insert(league_season_rule_state_table).values(
                season_id="season-one",
                active_version_id="rules-season-v1",
                updated_at=now,
            )
        )
        assert active_rule_version_id(connection, "season-one") == "rules-season-v1"
        assert immutable_rule_config(connection, "rules-season-v1") == config
        assert (
            connection.execute(
                select(league_season_rule_versions_table.c.version).where(
                    league_season_rule_versions_table.c.id == "rules-season-v1"
                )
            ).scalar_one()
            == 1
        )
