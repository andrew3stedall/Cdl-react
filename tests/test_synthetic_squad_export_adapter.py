import os

import pytest
from sqlalchemy import create_engine, insert, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.repositories.postgres_imports import (
    HISTORICAL_IMPORT_PERSISTENCE_TABLES,
    import_batches_table,
    import_review_items_table,
)
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    epl_teams_table,
    fpl_players_table,
    fpl_positions_table,
    leagues_table,
    seasons_table,
)
from cdl_api.repositories.postgres_squad import squad_ownerships_table
from cdl_api.repositories.postgres_squad_imports import (
    PostgreSQLHistoricalSquadImportRepository,
)
from cdl_api.services.historical_import_service import HistoricalImportService
from cdl_api.services.synthetic_squad_export_adapter import (
    SyntheticSquadMembershipExportAdapter,
)


def _document(
    *,
    batch_id: str = "squad-batch-1",
    player_id: str = "player-1",
    source_system: str = "deterministic-synthetic-squad",
) -> dict:
    return {
        "export_version": "synthetic-squad-export/v1",
        "batch_id": batch_id,
        "source_system": source_system,
        "rows": [
            {
                "membership_key": "membership-source-1",
                "target_ownership_id": "ownership-1",
                "season_id": "season-1",
                "team_source_key": "team-source-1",
                "target_team_id": "draft-team-1",
                "player_source_key": "player-source-1",
                "target_player_id": player_id,
                "started_at": "2026-07-01T00:00:00+00:00",
            }
        ],
    }


def _create_tables(engine: Engine) -> None:
    for table in HISTORICAL_IMPORT_PERSISTENCE_TABLES:
        table.create(engine)
    statements = (
        """CREATE TABLE leagues (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255),
            code VARCHAR(64)
        )""",
        """CREATE TABLE seasons (
            id VARCHAR(64) PRIMARY KEY,
            league_id VARCHAR(64),
            name VARCHAR(64),
            start_gameweek INTEGER,
            end_gameweek INTEGER
        )""",
        """CREATE TABLE draft_teams (
            id VARCHAR(64) PRIMARY KEY,
            league_id VARCHAR(64),
            manager_id VARCHAR(64),
            name VARCHAR(255)
        )""",
        """CREATE TABLE fpl_positions (
            id VARCHAR(16) PRIMARY KEY,
            singular_name VARCHAR(64),
            plural_name VARCHAR(64)
        )""",
        """CREATE TABLE epl_teams (
            id VARCHAR(64) PRIMARY KEY,
            short_name VARCHAR(16),
            name VARCHAR(255)
        )""",
        """CREATE TABLE fpl_players (
            id VARCHAR(64) PRIMARY KEY,
            first_name VARCHAR(255),
            second_name VARCHAR(255),
            web_name VARCHAR(255),
            position_id VARCHAR(16),
            team_id VARCHAR(64)
        )""",
        """CREATE TABLE squad_ownerships (
            id VARCHAR(64) PRIMARY KEY,
            season_id VARCHAR(64),
            draft_team_id VARCHAR(64),
            player_id VARCHAR(64),
            roster_slot_id VARCHAR(64),
            started_at DATETIME,
            ended_at DATETIME
        )""",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.exec_driver_sql(statement)


def _seed_dependencies(session_factory: sessionmaker[Session]) -> None:
    with session_factory() as session:
        session.execute(
            insert(leagues_table).values(
                id="league-1",
                name="Synthetic",
                code="SYN",
            )
        )
        session.execute(
            insert(seasons_table).values(
                id="season-1",
                league_id="league-1",
                name="2025/26",
                start_gameweek=1,
                end_gameweek=38,
            )
        )
        session.execute(
            insert(draft_teams_table).values(
                id="draft-team-1",
                league_id="league-1",
                manager_id=None,
                name="Synthetic Team",
            )
        )
        session.execute(
            insert(fpl_positions_table).values(
                id="MID",
                singular_name="Midfielder",
                plural_name="Midfielders",
            )
        )
        session.execute(
            insert(epl_teams_table).values(
                id="epl-team-1",
                short_name="SYN",
                name="Synthetic FC",
            )
        )
        session.execute(
            insert(fpl_players_table).values(
                id="player-1",
                first_name="Synthetic",
                second_name="Player",
                web_name="Synthetic",
                position_id="MID",
                team_id="epl-team-1",
            )
        )
        session.commit()


def _assert_release_path(session_factory: sessionmaker[Session]) -> None:
    adapter = SyntheticSquadMembershipExportAdapter()
    repository = PostgreSQLHistoricalSquadImportRepository(session_factory)
    service = HistoricalImportService(repository)
    batch = adapter.adapt(_document()).batch

    dry_run = service.execute(batch, dry_run=True)
    assert dry_run.projected_records == 1
    with session_factory() as session:
        assert session.execute(select(squad_ownerships_table.c.id)).all() == []

    committed = service.execute(batch, dry_run=False)
    assert committed.projected_records == 1
    replay = service.execute(batch, dry_run=False)
    assert replay.repeated_batch is True
    assert replay.unchanged_domain_records == 1

    with session_factory() as session:
        ownership = session.execute(select(squad_ownerships_table)).mappings().one()
    assert ownership["draft_team_id"] == "draft-team-1"
    assert ownership["player_id"] == "player-1"
    assert ownership["ended_at"] is None


def test_squad_adapter_projection_reviews_and_conflict_rollback() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)
    _seed_dependencies(session_factory)
    _assert_release_path(session_factory)

    adapter = SyntheticSquadMembershipExportAdapter()
    duplicate = _document(batch_id="squad-duplicate")
    duplicate["rows"].append(dict(duplicate["rows"][0]))
    adapted = adapter.adapt(duplicate)
    assert adapted.review_diagnostics == ["duplicate squad membership key: membership-source-1"]
    assert len(adapted.batch.records) == 1

    missing = adapter.adapt(
        _document(
            batch_id="squad-missing",
            player_id="missing-player",
            source_system="deterministic-synthetic-squad-missing",
        )
    )
    audit = HistoricalImportService(
        PostgreSQLHistoricalSquadImportRepository(session_factory)
    ).execute(missing.batch, dry_run=False)
    assert audit.projected_records == 0
    assert audit.review_items == ["membership-source-1"]
    with session_factory() as session:
        reason = session.execute(select(import_review_items_table.c.payload_json)).scalar_one()
    assert reason["reason"] == "missing_player"

    conflict = adapter.adapt(_document(batch_id="squad-conflict")).batch
    with session_factory() as session:
        session.execute(squad_ownerships_table.delete())
        session.execute(
            insert(squad_ownerships_table).values(
                id="ownership-1",
                season_id="season-1",
                draft_team_id="draft-team-1",
                player_id="player-1",
                roster_slot_id=None,
                started_at="2025-01-01T00:00:00+00:00",
                ended_at=None,
            )
        )
        session.commit()
    with pytest.raises(ValueError, match="already exists with different content"):
        HistoricalImportService(PostgreSQLHistoricalSquadImportRepository(session_factory)).execute(
            conflict, dry_run=False
        )
    with session_factory() as session:
        existing = session.execute(
            select(import_batches_table.c.id).where(import_batches_table.c.id == "squad-conflict")
        ).all()
    assert existing == []

    unsupported = _document()
    unsupported["export_version"] = "synthetic-squad-export/v2"
    with pytest.raises(ValueError, match="Unsupported synthetic squad export version"):
        adapter.adapt(unsupported)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_squad_projection_uses_migrated_tables() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)
    with session_factory() as session:
        tables = (
            squad_ownerships_table,
            *reversed(HISTORICAL_IMPORT_PERSISTENCE_TABLES),
            fpl_players_table,
            draft_teams_table,
            seasons_table,
            epl_teams_table,
            fpl_positions_table,
            leagues_table,
        )
        for table in tables:
            session.execute(table.delete())
        session.commit()
    _seed_dependencies(session_factory)
    _assert_release_path(session_factory)
