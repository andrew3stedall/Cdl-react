from collections import Counter

from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.repositories.postgres_league_fixtures import (
    PostgreSQLLeagueRepository,
    cdl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
)
from cdl_api.repositories.postgres_league_fixtures import (
    metadata as fixture_metadata,
)
from cdl_api.staging_draft_seed import LEAGUE_ID
from cdl_api.staging_fixture_seed import (
    BASE_ROUND_ROBIN,
    SOURCE_TEAM_NAMES,
    STAGING_FIXTURE_SCHEDULE,
    seed_staging_fixture_schedule,
    validate_staging_fixture_schedule,
)


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    fixture_metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE draft_teams ("
                "id TEXT PRIMARY KEY, league_id TEXT, manager_id TEXT, name TEXT)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO draft_teams (id, league_id, manager_id, name) VALUES "
                "('team-exeter-gently', :league, 'manager-1', 'Exeter Gently'), "
                "('team-stan-still-sells-tik', :league, 'manager-2', 'Stan Still Sells Tik'), "
                "('team-koden-all-stars', :league, 'manager-3', 'Koden All Stars'), "
                "('team-dicks-dribbling-xi', :league, 'manager-4', 'Dicks Dribbling XI'), "
                "('team-sporting-lesbians', :league, 'manager-5', 'Sporting Lesbians'), "
                "('team-bayer-neverlusen', :league, 'manager-6', 'Bayer Neverlusen'), "
                "('team-wilde-boars', :league, 'manager-7', 'Wilde Boars'), "
                "('team-class-of-84', :league, 'manager-8', 'Class of 84')"
            ),
            {"league": LEAGUE_ID},
        )
    return sessionmaker(bind=engine, class_=Session)


def test_source_round_robin_is_complete_and_repeated_for_35_gameweeks() -> None:
    validate_staging_fixture_schedule()

    assert len(BASE_ROUND_ROBIN) == 7
    assert len(STAGING_FIXTURE_SCHEDULE) == 140
    assert (
        len({frozenset(fixture) for round_rows in BASE_ROUND_ROBIN for fixture in round_rows}) == 28
    )

    per_gameweek = Counter(row.gameweek for row in STAGING_FIXTURE_SCHEDULE)
    assert per_gameweek == {gameweek: 4 for gameweek in range(1, 36)}
    assert {row.home_team for row in STAGING_FIXTURE_SCHEDULE} | {
        row.away_team for row in STAGING_FIXTURE_SCHEDULE
    } == set(SOURCE_TEAM_NAMES)


def test_fixture_schedule_seed_is_idempotent_and_exposes_week_one_as_next() -> None:
    session_factory = _session_factory()

    first = seed_staging_fixture_schedule(session_factory)
    second = seed_staging_fixture_schedule(session_factory)

    assert first == second
    assert first.gameweeks == 35
    assert first.fixtures == 140
    assert first.teams == 8

    with session_factory() as session:
        assert (
            session.execute(select(func.count()).select_from(cdl_fixtures_table)).scalar_one()
            == 140
        )
        assert (
            session.execute(select(func.count()).select_from(fixture_results_table)).scalar_one()
            == 140
        )
        assert (
            session.execute(
                select(func.count()).select_from(fixture_scoring_snapshots_table)
            ).scalar_one()
            == 140
        )

    fixtures = PostgreSQLLeagueRepository(session_factory).list_fixtures()
    assert len(fixtures) == 140
    assert [fixture.gameweek.number for fixture in fixtures[:4]] == [1, 1, 1, 1]
    assert sum(fixture.is_next for fixture in fixtures) == 4
    assert all(fixture.score.outcome == "pending" for fixture in fixtures)
