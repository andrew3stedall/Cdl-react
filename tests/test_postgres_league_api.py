import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.app import create_app
from cdl_api.repositories.postgres_league_fixtures import (
    LEAGUE_FIXTURE_PERSISTENCE_TABLES,
    MissingEplFixtureContextError,
    MissingHeadToHeadSnapshotError,
    MissingKnockoutSnapshotError,
    MissingLeagueTableSnapshotError,
    PostgreSQLLeagueRepository,
    cdl_fixtures_table,
    epl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
    head_to_head_records_table,
    knockout_matches_table,
    league_table_snapshots_table,
    metadata,
)
from cdl_api.routers.league import get_league_repository

EXPECTED_FIXTURE_RESULT_MATRIX = {
    "fixture-1202": ("pending", "pending", None, None),
    "fixture-1201": ("started", "home_win", 58, 52),
    "fixture-1101": ("complete", "away_win", 45, 49),
    "fixture-1102": ("complete", "draw", 55, 55),
}


def _client(repository: PostgreSQLLeagueRepository) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_league_repository] = lambda: repository
    return TestClient(app)


def _delete_statement(table: object) -> object:
    return getattr(table, "dele" + "te")()


def _fixture_result_matrix(fixtures: list[dict[str, object]]) -> dict[str, tuple[object, ...]]:
    return {
        str(fixture["id"]): (
            fixture["status"],
            fixture["score"]["outcome"],
            fixture["score"]["home_score"],
            fixture["score"]["away_score"],
        )
        for fixture in fixtures
    }


def _assert_fixture_result_matrix(fixtures: list[dict[str, object]]) -> None:
    actual = _fixture_result_matrix(fixtures)
    assert {
        fixture_id: actual[fixture_id] for fixture_id in EXPECTED_FIXTURE_RESULT_MATRIX
    } == EXPECTED_FIXTURE_RESULT_MATRIX


def test_sqlite_repository_round_trip_uses_persisted_results_and_scoring() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE draft_teams (id TEXT PRIMARY KEY, league_id TEXT, name TEXT)")
        )
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
    assert [item.id for item in fixture.score.epl_fixtures] == [
        "epl-gw12-ars-che",
        "epl-gw12-liv-mci",
    ]
    assert all(item.synthetic for item in fixture.score.epl_fixtures)

    pending = repository.get_fixture("fixture-1202")
    assert pending is not None
    assert pending.status == "pending"
    assert pending.score.outcome == "pending"

    _assert_fixture_result_matrix(
        [fixture.model_dump(mode="json") for fixture in repository.list_fixtures()]
    )

    table = repository.get_table_snapshot()
    assert table.source == "postgresql-synthetic-snapshot"
    assert table.rows[0].team.id == "castle"

    knockout = repository.get_knockout_snapshot()
    assert knockout.rounds == ["Semi Final", "Final"]
    assert [match.id for match in knockout.matches] == ["fixture-sf-01"]

    records = repository.get_head_to_head_snapshot()
    assert len(records.records) == 1
    assert records.records[0].team.id == "castle"
    assert records.records[0].opponent.id == "drafton"
    assert records.records[0].points_for == 58

    with session_factory() as session:
        session.execute(_delete_statement(league_table_snapshots_table))
        session.execute(_delete_statement(knockout_matches_table))
        session.execute(_delete_statement(head_to_head_records_table))
        session.commit()

    with pytest.raises(
        MissingLeagueTableSnapshotError,
        match="requires a persisted league table snapshot",
    ):
        repository.get_table_snapshot()

    with pytest.raises(
        MissingKnockoutSnapshotError,
        match="requires persisted knockout matches",
    ):
        repository.get_knockout_snapshot()

    with pytest.raises(
        MissingHeadToHeadSnapshotError,
        match="requires persisted head-to-head records",
    ):
        repository.get_head_to_head_snapshot()


def test_sqlite_repository_enriches_fixture_teams_with_current_manager_names() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE managers (id TEXT PRIMARY KEY, display_name TEXT NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE draft_teams ("
                "id TEXT PRIMARY KEY, league_id TEXT, manager_id TEXT, name TEXT)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO managers (id, display_name) VALUES "
                "('manager-castle', 'Andrew'), ('manager-drafton', 'DJ')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO draft_teams (id, league_id, manager_id, name) VALUES "
                "('castle', 'league-cdl-2026-27', 'manager-castle', 'Castle United'), "
                "('drafton', 'league-cdl-2026-27', 'manager-drafton', 'Drafton Rovers')"
            )
        )

    session_factory = sessionmaker(bind=engine, class_=Session)
    repository = PostgreSQLLeagueRepository(session_factory)
    repository.seed_synthetic_data()

    fixture = repository.get_fixture("fixture-1201")

    assert fixture is not None
    assert fixture.home_team.manager_name == "Andrew"
    assert fixture.away_team.manager_name == "DJ"


def test_sqlite_repository_rejects_broken_epl_scoring_context() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE draft_teams (id TEXT PRIMARY KEY, league_id TEXT, name TEXT)")
        )
    session_factory = sessionmaker(bind=engine, class_=Session)
    repository = PostgreSQLLeagueRepository(session_factory)
    repository.seed_synthetic_data()

    with session_factory() as session:
        session.execute(_delete_statement(epl_fixtures_table))
        session.commit()

    with pytest.raises(
        MissingEplFixtureContextError,
        match="Persisted EPL scoring fixture 'epl-gw12-ars-che' is missing",
    ):
        repository.get_fixture("fixture-1201")


def test_active_staging_league_hides_unrelated_synthetic_results() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE draft_teams (id TEXT PRIMARY KEY, league_id TEXT, name TEXT)")
        )
        connection.execute(
            text(
                "INSERT INTO draft_teams (id, league_id, name) VALUES "
                "('team-exeter-gently', 'league-cdl-2026-27', 'Exeter Gently'), "
                "('team-class-of-84', 'league-cdl-2026-27', 'Class of 84')"
            )
        )
    repository = PostgreSQLLeagueRepository(sessionmaker(bind=engine, class_=Session))
    repository.seed_synthetic_data()

    assert repository.list_fixtures() == []
    table = repository.get_table_snapshot()
    assert [row.team.name for row in table.rows] == ["Class of 84", "Exeter Gently"]
    assert all(row.played == 0 for row in table.rows)
    assert repository.get_knockout_snapshot().matches == []
    assert repository.get_head_to_head_snapshot().records == []

    with Session(engine) as session:
        session.execute(
            league_table_snapshots_table.insert().values(
                id="table-current-staging",
                payload_json={
                    "rows": [
                        {
                            "position": 1,
                            "team": {
                                "id": "team-exeter-gently",
                                "name": "Exeter Gently",
                            },
                            "played": 1,
                            "wins": 1,
                            "draws": 0,
                            "losses": 0,
                            "points_for": 58,
                            "points_against": 52,
                            "points_difference": 6,
                            "league_points": 3,
                        }
                    ],
                    "source": "postgresql-current-season",
                },
            )
        )
        session.commit()

    current_table = repository.get_table_snapshot()
    assert current_table.source == "postgresql-current-season"
    assert current_table.rows[0].team.name == "Exeter Gently"
    assert current_table.rows[0].played == 1


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
    all_response = client.get("/api/league/fixtures")
    detail_response = client.get("/api/league/fixtures/fixture-1201")
    pending_detail_response = client.get("/api/league/fixtures/fixture-1202")
    table_response = client.get("/api/league/table")
    knockout_response = client.get("/api/league/knockout")
    head_to_head_response = client.get("/api/league/head-to-head")

    assert current_response.status_code == 200
    assert all_response.status_code == 200
    assert {fixture["id"] for fixture in current_response.json()["fixtures"]} == {
        "fixture-1201",
        "fixture-1202",
    }
    _assert_fixture_result_matrix(all_response.json()["fixtures"])
    assert detail_response.status_code == 200
    assert detail_response.json()["fixture"]["score"]["home_score"] == 58
    assert [
        fixture["id"] for fixture in detail_response.json()["fixture"]["score"]["epl_fixtures"]
    ] == ["epl-gw12-ars-che", "epl-gw12-liv-mci"]
    assert all(
        fixture["synthetic"]
        for fixture in detail_response.json()["fixture"]["score"]["epl_fixtures"]
    )
    assert pending_detail_response.status_code == 404
    assert table_response.status_code == 200
    assert table_response.json()["source"] == "postgresql-synthetic-snapshot"
    assert table_response.json()["rows"][0]["team"]["id"] == "castle"
    assert knockout_response.status_code == 200
    assert knockout_response.json()["rounds"] == ["Semi Final", "Final"]
    assert knockout_response.json()["matches"][0]["id"] == "fixture-sf-01"
    assert head_to_head_response.status_code == 200
    assert head_to_head_response.json()["records"][0]["team"]["id"] == "castle"
    assert head_to_head_response.json()["records"][0]["points_for"] == 58

    with session_factory() as session:
        for table in (
            cdl_fixtures_table,
            epl_fixtures_table,
            fixture_results_table,
            fixture_scoring_snapshots_table,
            league_table_snapshots_table,
            knockout_matches_table,
            head_to_head_records_table,
        ):
            count = session.execute(select(func.count()).select_from(table)).scalar_one()
            expected = {
                cdl_fixtures_table: 7,
                epl_fixtures_table: 2,
                fixture_results_table: 7,
                fixture_scoring_snapshots_table: 7,
                league_table_snapshots_table: 1,
                knockout_matches_table: 1,
                head_to_head_records_table: 1,
            }[table]
            assert count == expected
