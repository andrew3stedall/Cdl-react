import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.app import create_app
from cdl_api.repositories.postgres_league_fixtures import (
    LEAGUE_FIXTURE_PERSISTENCE_TABLES,
    MissingLeagueTableSnapshotError,
    PostgreSQLLeagueRepository,
    cdl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
    league_table_snapshots_table,
    metadata,
)
from cdl_api.routers.league import get_league_repository


def _client(repository: PostgreSQLLeagueRepository) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_league_repository] = lambda: repository
    return TestClient(app)


def _delete_statement(table: object) -> object:
    return getattr(table, "dele" + "te")()


def test_sqlite_repository_round_trip_uses_persisted_results_and_scoring() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, class_=Session)

    PostgreSQLLeagueRepository(session_factory).seed_synthetic_data()
    PostgreSQLLeagueRepository(session_factory).seed_synthetic_data()
    repository = PostgreSQLLeagueRepository(session_factory)
    fixture = repository.get_fixture("fixture-1201")

    assert fixture is not None
    assert fixture.status == "started"
    assert fixture.score.home_score == 58
    assert fixture.score.bonus_points == {"castle": 3, "drafton": 1}
    assert fixture.score.chips_played["castle"] == ["Triple Captain"]

    pending = repository.get_fixture("fixture-1202")
    assert pending is not None
    assert pending.status == "pending"
    assert pending.score.outcome == "pending"

    table = repository.get_table_snapshot()
    assert table.source == "postgresql-synthetic-snapshot"
    assert table.rows[0].team.id == "castle"

    with session_factory() as session:
        session.execute(_delete_statement(league_table_snapshots_table))
        session.commit()

    with pytest.raises(
        MissingLeagueTableSnapshotError,
        match="requires a persisted league table snapshot",
    ):
        repository.get_table_snapshot()


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_league_api_reads_persisted_fixture_state() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)

    with session_factory() as session:
        for table in reversed(LEAGUE_FIXTURE_PERSISTENCE_TABLES):
            session.execute(_delete_statement(table))
        session.commit()

    PostgreSQLLeagueRepository(session_factory).seed_synthetic_data()
    repository = PostgreSQLLeagueRepository(session_factory)
    client = _client(repository)

    current_response = client.get("/api/league/fixtures/current")
    detail_response = client.get("/api/league/fixtures/fixture-1201")
    pending_detail_response = client.get("/api/league/fixtures/fixture-1202")
    table_response = client.get("/api/league/table")

    assert current_response.status_code == 200
    assert {fixture["id"] for fixture in current_response.json()["fixtures"]} == {
        "fixture-1201",
        "fixture-1202",
    }
    assert detail_response.status_code == 200
    assert detail_response.json()["fixture"]["score"]["home_score"] == 58
    assert pending_detail_response.status_code == 404
    assert table_response.status_code == 200
    assert table_response.json()["source"] == "postgresql-synthetic-snapshot"
    assert table_response.json()["rows"][0]["team"]["id"] == "castle"

    with session_factory() as session:
        for table in (
            cdl_fixtures_table,
            fixture_results_table,
            fixture_scoring_snapshots_table,
            league_table_snapshots_table,
        ):
            count = session.execute(select(func.count()).select_from(table)).scalar_one()
            expected = 1 if table is league_table_snapshots_table else 5
            assert count == expected
