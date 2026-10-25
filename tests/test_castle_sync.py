"""Import replays run against real SQLAlchemy tables, not write-call mocks."""

import copy
import os
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import MetaData, create_engine, func, insert, select, update
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.castle_sync import INSTANCE, staging_database_url
from cdl_api.contracts.castle_sync import CastleSyncConfig
from cdl_api.contracts.league_models import LeagueFixture
from cdl_api.repositories.castle_sync import CastleSyncRepository
from cdl_api.repositories.postgres_auth import users_table
from cdl_api.repositories.postgres_fpl_data import (
    FPL_INGESTION_TABLES,
    external_payload_cache_table,
    fpl_gameweeks_table,
)
from cdl_api.repositories.postgres_imports import (
    HISTORICAL_IMPORT_PERSISTENCE_TABLES,
    import_batches_table,
    import_source_mappings_table,
    import_source_payloads_table,
)
from cdl_api.repositories.postgres_league_fixtures import (
    LEAGUE_FIXTURE_PERSISTENCE_TABLES,
    cdl_fixtures_table,
)
from cdl_api.repositories.postgres_league_fpl import (
    CORE_LEAGUE_TABLES,
    draft_teams_table,
    epl_teams_table,
    fpl_players_table,
    fpl_positions_table,
    leagues_table,
    managers_table,
    seasons_table,
)
from cdl_api.repositories.postgres_squad import SQUAD_PERSISTENCE_TABLES
from cdl_api.repositories.postgres_team_selection import TEAM_SELECTION_PERSISTENCE_TABLES
from cdl_api.services.castle_source_adapter import CastleSourceAdapter


def _metadata() -> MetaData:
    metadata = MetaData()
    tables = (
        users_table,
        *CORE_LEAGUE_TABLES,
        *SQUAD_PERSISTENCE_TABLES,
        *TEAM_SELECTION_PERSISTENCE_TABLES,
        *FPL_INGESTION_TABLES,
        *LEAGUE_FIXTURE_PERSISTENCE_TABLES,
        *HISTORICAL_IMPORT_PERSISTENCE_TABLES,
    )
    for table in tables:
        if table.name not in metadata.tables:
            table.to_metadata(metadata)
    return metadata


@pytest.fixture
def factory() -> sessionmaker[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    _metadata().create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)


def _seed(factory: sessionmaker[Session], suffix: str = "") -> CastleSyncConfig:
    league, season = f"league{suffix}", f"season{suffix}"
    with factory.begin() as session:
        session.execute(insert(leagues_table).values(id=league, name="Test", code=league))
        session.execute(
            insert(seasons_table).values(
                id=season, league_id=league, name="2026/27", start_gameweek=1, end_gameweek=38
            )
        )
        for index in (1, 2):
            mid, tid = f"m{index}{suffix}", f"t{index}{suffix}"
            session.execute(insert(managers_table).values(id=mid, user_id=None, display_name=mid))
            session.execute(
                insert(draft_teams_table).values(
                    id=tid, league_id=league, manager_id=mid, name=f"Team {index}"
                )
            )
        if not session.execute(
            select(fpl_gameweeks_table.c.id).where(fpl_gameweeks_table.c.id == "1")
        ).first():
            session.execute(
                insert(fpl_gameweeks_table).values(
                    id="1",
                    name="Gameweek 1",
                    is_previous=False,
                    is_current=True,
                    is_next=False,
                    finished=False,
                    data_checked=False,
                )
            )
    return CastleSyncConfig(target_league_id=league, target_season_id=season)


def _bundle(source_id: str = "source") -> dict:
    root = f"leagues/{source_id}/"
    source = {
        "leagues": [{"id": source_id, "season_number": 14, "season_label": "2026/27"}],
        "league_members": [{"league_id": source_id, "user_id": "u1"}],
        "profiles": [{"id": "u1", "display_name": "Private source name"}],
        "castle_teams": [
            {"id": "s1", "name": "Team 1", "owner_user_id": "u1"},
            {"id": "s2", "name": "Team 2", "owner_user_id": "u2"},
        ],
        "draft_picks": [],
        "lineups": [],
        "trades": [],
        "draws": [],
        "draw_results": [],
        "castle_fixtures": [
            {
                "id": "f1",
                "home_team_id": "s1",
                "away_team_id": "s2",
                "stage": "regular",
                "leg": 1,
                "gameweek": 1,
                "home_score": None,
                "away_score": None,
            }
        ],
    }
    files = {root + name + ".json": rows for name, rows in source.items()}
    files["self/memberships.json"] = [{"league_id": source_id, "user_id": "u1"}]
    files["fpl/bootstrap.json"] = {"sensitive_unused_fpl": True}
    return {
        "files": files,
        "manifest": {
            "format": "castle-data-export-v1",
            "failures": [],
            "collections": [
                {"file": path, "rows": len(data)}
                for path, data in files.items()
                if isinstance(data, list)
            ],
        },
    }


def _count(factory: sessionmaker[Session], table: object) -> int:
    with factory() as session:
        return session.execute(select(func.count()).select_from(table)).scalar_one()


def test_archive_plan_apply_repeat_and_history(factory: sessionmaker[Session]) -> None:
    config = _seed(factory)
    repository = CastleSyncRepository(factory)
    bundle = _bundle()
    plan = repository.run(bundle, config)
    assert _count(factory, import_source_payloads_table) == 0
    assert "Private source name" not in str(plan)
    assert plan["source_files"] == 11
    result = repository.run(bundle, config, apply=True, expected_plan=plan["plan_digest"])
    assert result["applied"]
    original_count = _count(factory, import_source_payloads_table)
    second = repository.run(bundle, config)
    repository.run(bundle, config, apply=True, expected_plan=second["plan_digest"])
    assert _count(factory, import_source_payloads_table) == original_count
    assert _count(factory, import_batches_table) == 1
    updated = copy.deepcopy(bundle)
    updated["files"]["leagues/source/profiles.json"][0]["display_name"] = "Changed"
    changed = repository.run(updated, config)
    repository.run(updated, config, apply=True, expected_plan=changed["plan_digest"])
    assert _count(factory, import_source_payloads_table) == original_count + 1
    with factory() as session:
        payloads = list(
            session.execute(select(import_source_payloads_table.c.payload_json)).scalars()
        )
    assert sum(p.get("archived", False) for p in payloads) == 1
    assert all("fpl/bootstrap" not in p.get("source_record_id", "") for p in payloads)


def test_stale_plan_rolls_back_every_write(factory: sessionmaker[Session]) -> None:
    config = _seed(factory)
    repository = CastleSyncRepository(factory)
    plan = repository.run(_bundle(), config)
    changed = _bundle()
    changed["files"]["leagues/source/profiles.json"][0]["display_name"] = "Changed"
    with pytest.raises(ValueError, match="changed"):
        repository.run(changed, config, apply=True, expected_plan=plan["plan_digest"])
    assert _count(factory, import_source_payloads_table) == 0
    assert _count(factory, import_batches_table) == 0


def test_native_repeat_and_local_edit_conflict(factory: sessionmaker[Session]) -> None:
    config = _seed(factory).model_copy(update={"projection": "native"})
    repository = CastleSyncRepository(factory)
    plan = repository.run(_bundle(), config)
    repository.run(
        _bundle(), config, apply=True, expected_plan=plan["plan_digest"], allow_projection_gaps=True
    )
    assert _count(factory, cdl_fixtures_table) == 1
    with factory.begin() as session:
        row = session.execute(select(cdl_fixtures_table)).mappings().one()
        session.execute(
            update(cdl_fixtures_table)
            .where(cdl_fixtures_table.c.id == row["id"])
            .values(payload_json={**row["payload_json"], "kickoff_label": "Local edit"})
        )
    plan = repository.run(_bundle(), config)
    assert plan["native_conflicts"] == 1
    before = _count(factory, import_source_payloads_table)
    with pytest.raises(ValueError, match="conflicts"):
        repository.run(
            _bundle(),
            config,
            apply=True,
            expected_plan=plan["plan_digest"],
            allow_projection_gaps=True,
        )
    assert _count(factory, import_source_payloads_table) == before


def test_bad_season_and_truncated_input_rejected(factory: sessionmaker[Session]) -> None:
    config = _seed(factory)
    bad = _bundle()
    bad["files"]["leagues/source/leagues.json"][0]["season_label"] = "2025/26"
    with pytest.raises(ValueError, match="season labels"):
        CastleSyncRepository(factory).run(bad, config)
    bad = _bundle()
    bad["files"]["leagues/source/draw_results.json"] = [{"id": "unverified"}]
    with pytest.raises(ValueError, match="truncated"):
        CastleSyncRepository(factory).run(bad, config)


def test_missing_snapshot_multi_awards_preserved(factory: sessionmaker[Session]) -> None:
    config = _seed(factory)
    bundle = _bundle()
    bundle["files"]["leagues/source/draw_results.json"] = [
        {"id": f"r{i}", "fpl_player_id": i, "player_web_name": f"P{i}", "element_type": 3}
        for i in (1, 2)
    ]
    bundle["manifest"]["collections"] = [
        {"file": p, "rows": len(v)} for p, v in bundle["files"].items() if isinstance(v, list)
    ]
    plan = CastleSyncRepository(factory).run(bundle, config)
    assert plan["gaps"]["multi_award_draw_history_archived_not_projected"] == 2
    assert plan["native_changes"].get("free_agency_results", 0) == 0


def test_explicit_team_alias_and_ambiguous_mapping(factory: sessionmaker[Session]) -> None:
    config = _seed(factory)
    bundle = _bundle()
    bundle["files"]["leagues/source/castle_teams.json"][0]["name"] = "A renamed team"
    bad = CastleSyncRepository(factory).run(bundle, config)
    assert bad["gaps"]["unmapped_or_ambiguous_team"] == 1
    fixed = config.model_copy(update={"team_aliases": {"A renamed team": "t1"}})
    assert (
        CastleSyncRepository(factory)
        .run(bundle, fixed)["gaps"]
        .get("unmapped_or_ambiguous_team", 0)
        == 0
    )


def test_database_destination_boundary() -> None:
    url = staging_database_url(
        f"postgresql+psycopg://cdl_app:example@/cdl_react?host=/cloudsql/{INSTANCE}"
    )
    assert "127.0.0.1:5433" in url
    with pytest.raises(ValueError, match="staging boundary"):
        staging_database_url("postgresql+psycopg://cdl_app:example@production/other")


def test_persistent_player_code_uses_existing_cache_without_fpl_writes(
    factory: sessionmaker[Session],
) -> None:
    config = _seed(factory)
    with factory.begin() as session:
        session.execute(
            insert(fpl_positions_table).values(
                id="MID", singular_name="Midfielder", plural_name="Midfielders"
            )
        )
        session.execute(insert(epl_teams_table).values(id="club", short_name="CLB", name="Club"))
        session.execute(
            insert(fpl_players_table).values(
                id="fpl-1",
                first_name="A",
                second_name="B",
                web_name="B",
                position_id="MID",
                team_id="club",
            )
        )
        from datetime import UTC, datetime

        session.execute(
            insert(external_payload_cache_table).values(
                resource="bootstrap-static",
                endpoint="existing",
                payload_json={"elements": [{"id": 1, "code": 777}]},
                response_sha256="x" * 64,
                fetched_at=datetime.now(UTC),
            )
        )
    bundle = _bundle()
    bundle["files"]["leagues/source/draft_picks.json"] = [
        {
            "id": "pick",
            "user_id": "u1",
            "fpl_player_id": 100,
            "fpl_player_code": 777,
            "player_web_name": "B",
            "element_type": 3,
        }
    ]
    bundle["manifest"]["collections"] = [
        {"file": p, "rows": len(v)} for p, v in bundle["files"].items() if isinstance(v, list)
    ]
    repository = CastleSyncRepository(factory)
    plan = repository.run(bundle, config)
    repository.run(bundle, config, apply=True, expected_plan=plan["plan_digest"])
    with factory() as session:
        maps = list(session.execute(select(import_source_mappings_table.c.payload_json)).scalars())
        assert next(m for m in maps if m["source_key"] == "player:100")["target_id"] == "fpl-1"
    assert _count(factory, fpl_players_table) == 1
    assert _count(factory, users_table) == 0


def test_rebinding_existing_source_team_is_blocked(factory: sessionmaker[Session]) -> None:
    config = _seed(factory)
    repository = CastleSyncRepository(factory)
    plan = repository.run(_bundle(), config)
    repository.run(_bundle(), config, apply=True, expected_plan=plan["plan_digest"])
    rebound = config.model_copy(update={"team_aliases": {"Team 1": "t2", "Team 2": "t1"}})
    plan = repository.run(_bundle(), rebound)
    assert plan["mapping_conflicts"] > 0
    with pytest.raises(ValueError, match="mapping conflicts"):
        repository.run(_bundle(), rebound, apply=True, expected_plan=plan["plan_digest"])


def test_workflow_is_manual_and_retains_no_plaintext_artifact() -> None:
    workflow = (Path(__file__).parents[1] / ".github/workflows/castle-sync-staging.yml").read_text()
    assert "workflow_dispatch:" in workflow
    assert "\n  push:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "IMPORT CASTLE STAGING" in workflow
    assert workflow.index("Check boundary and apply confirmation") < workflow.index(
        "Fetch fresh Castle"
    )
    artifacts = workflow.split("Retain report and encrypted evidence")[1]
    assert "castle-sync-input.json" not in artifacts
    assert "retention-days: 3" in artifacts


def test_native_lineup_and_completed_trade_projection() -> None:
    config = CastleSyncConfig(target_league_id="league", target_season_id="season")
    bundle = _bundle()
    root = "leagues/source/"
    players = [
        {
            "id": f"p{i}",
            "user_id": "u1",
            "fpl_player_id": i,
            "player_web_name": f"P{i}",
            "element_type": 3,
        }
        for i in range(1, 13)
    ]
    bundle["files"][root + "draft_picks.json"] = players
    bundle["files"][root + "lineups.json"] = [
        {
            "id": "lineup",
            "user_id": "u1",
            "gameweek": 1,
            "starter_ids": list(range(1, 12)),
            "bench_ids": [12],
            "captain_id": 1,
            "vice_captain_id": 2,
            "updated_at": "2026-10-01T00:00:00Z",
            "locked_at": None,
        }
    ]
    bundle["files"][root + "trades.json"] = [
        {
            "id": "trade",
            "proposer_id": "u1",
            "receiver_id": "u2",
            "status": "approved",
            "is_loan": False,
            "executed_gw": 1,
            "proposer_players": [players[0]],
            "receiver_players": [],
            "created_at": "2026-09-01T00:00:00Z",
            "updated_at": "2026-09-02T00:00:00Z",
        }
    ]
    bundle["manifest"]["collections"] = [
        {"file": p, "rows": len(v)} for p, v in bundle["files"].items() if isinstance(v, list)
    ]
    catalog = {
        "seasons": [{"id": "season", "league_id": "league", "name": "2026/27"}],
        "draft_teams": [
            {"id": f"t{i}", "manager_id": f"m{i}", "league_id": "league", "name": f"Team {i}"}
            for i in (1, 2)
        ],
        "managers": [{"id": f"m{i}"} for i in (1, 2)],
        "fpl_players": [
            {"id": f"fpl-{i}", "web_name": f"P{i}", "position_id": "MID"} for i in range(1, 13)
        ],
        "fpl_gameweeks": [{"id": "1", "finished": False, "is_current": True}],
    }
    adapter = CastleSourceAdapter(bundle, config, catalog)
    adapter.build_projections()
    lineups = [p for p in adapter.projections if p["table"] == "team_selection_lineup_slots"]
    assert len(lineups) == 12
    assert sum(p["values"]["is_captain"] for p in lineups) == 1
    trade = next(p for p in adapter.projections if p["table"] == "trade_proposals")
    assert trade["values"]["approval_status"] == "approved"
    assert trade["values"]["executed_at"] is None
    fixture = next(p for p in adapter.projections if p["table"] == "cdl_fixtures")
    assert LeagueFixture.model_validate(fixture["values"]["payload_json"]).detail_available is False
    bundle["files"][root + "trades.json"][0]["status"] = "receiver_accepted"
    pending = CastleSourceAdapter(bundle, config, catalog)
    pending.build_projections()
    assert not any(p["table"] == "trade_proposals" for p in pending.projections)


def test_membership_and_missing_gameweek_fail_conservatively(
    factory: sessionmaker[Session],
) -> None:
    config = _seed(factory)
    bad = _bundle()
    bad["files"]["self/memberships.json"] = []
    with pytest.raises(ValueError, match="membership"):
        CastleSyncRepository(factory).run(bad, config)
    with factory.begin() as session:
        session.execute(fpl_gameweeks_table.delete())
    plan = CastleSyncRepository(factory).run(_bundle(), config)
    assert plan["gaps"]["fixture_gameweek_context_missing"] == 1
    assert plan["native_changes"] == {}


@pytest.mark.skipif(
    not os.environ.get("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="PostgreSQL service required",
)
def test_postgres_archive_replay_in_rolled_back_transaction() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    suffix = uuid4().hex[:10]
    with engine.connect() as connection:
        transaction = connection.begin()
        factory = sessionmaker(connection, join_transaction_mode="create_savepoint")
        try:
            config = _seed(factory, suffix)
            repository = CastleSyncRepository(factory)
            source = _bundle("source-" + suffix)
            plan = repository.run(source, config)
            repository.run(source, config, apply=True, expected_plan=plan["plan_digest"])
            second = repository.run(source, config)
            assert second["source_changes"].get("created_files", 0) == 0
            assert second["source_changes"]["unchanged_files"] == plan["source_files"]
            native = config.model_copy(update={"projection": "native"})
            plan = repository.run(source, native)
            repository.run(
                source,
                native,
                apply=True,
                expected_plan=plan["plan_digest"],
                allow_projection_gaps=True,
            )
            assert repository.run(source, native)["native_conflicts"] == 0
        finally:
            transaction.rollback()
    engine.dispose()
