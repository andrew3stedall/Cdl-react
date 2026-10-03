from datetime import UTC, datetime

from sqlalchemy import create_engine, insert, select, text
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.repositories.postgres_fpl_data import fpl_gameweeks_table
from cdl_api.repositories.postgres_league_fixtures import (
    PostgreSQLLeagueRepository,
    cdl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
    knockout_matches_table,
    metadata,
)
from cdl_api.staging_draft_seed import LEAGUE_ID

ScoreRow = tuple[str, int, str, str, str, int | None, int | None, int | None, int | None]


def _repository_with_playoffs(
    *, include_scheduled_legs: bool = True
) -> tuple[sessionmaker[Session], PostgreSQLLeagueRepository]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    metadata.create_all(engine)
    fpl_gameweeks_table.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE draft_teams (id TEXT PRIMARY KEY, league_id TEXT, name TEXT)")
        )
    session_factory = sessionmaker(bind=engine, class_=Session)
    now = datetime.now(UTC).isoformat()
    teams = {
        team_id: {"id": team_id, "name": team_id.upper(), "short_name": team_id.upper()}
        for team_id in ("a", "b", "c", "d")
    }
    score_rows: list[ScoreRow] = [
        ("regular-a-d", 35, "Regular season", "a", "d", 5, 0, 3, 0),
        ("regular-b-c", 35, "Regular season", "b", "c", 2, 0, 2, 0),
        ("semi1-leg1", 36, "Semi Final", "a", "d", 3, 1, 2, 1),
        ("semi1-leg2", 37, "Semi Final", "d", "a", 2, 1, 1, 1),
        ("semi2-leg1", 36, "Semi Final", "b", "c", 1, 1, 1, 0),
        ("semi2-leg2", 37, "Semi Final", "c", "b", 0, 0, 0, 1),
        ("bottom-leg1", 37, "Bottom Final", "c", "d", 1, 0, 1, 0),
        ("bottom-leg2", 38, "Bottom Final", "d", "c", 2, 1, 1, 0),
        ("top-final", 38, "Final", "a", "b", None, None, None, None),
        ("third-place", 38, "Third Place", "d", "c", None, None, None, None),
    ]
    if not include_scheduled_legs:
        score_rows = score_rows[:2]
    with session_factory() as session:
        session.execute(
            insert(fpl_gameweeks_table),
            [
                {
                    "id": str(number),
                    "name": f"GW{number}",
                    "deadline_time": None,
                    "is_previous": False,
                    "is_current": False,
                    "is_next": False,
                    "finished": number == 35,
                    "data_checked": number == 35,
                }
                for number in (35, 36, 37, 38)
            ],
        )
        session.execute(
            text("INSERT INTO draft_teams (id, league_id, name) VALUES (:id, :league, :name)"),
            [{"id": team_id, "league": LEAGUE_ID, "name": team_id.upper()} for team_id in teams],
        )
        for (
            fixture_id,
            gameweek,
            round_label,
            home,
            away,
            home_score,
            away_score,
            home_goals,
            away_goals,
        ) in score_rows:
            is_settled = home_score is not None
            fixture = {
                "id": fixture_id,
                "gameweek": {"id": str(gameweek), "name": f"GW{gameweek}", "number": gameweek},
                "home_team": teams[home],
                "away_team": teams[away],
                "status": "complete" if is_settled else "pending",
                "kickoff_label": f"{round_label} fixture",
                "round_label": round_label,
                "detail_available": is_settled,
                "score": {"outcome": "pending"},
                "synthetic": False,
            }
            session.execute(insert(cdl_fixtures_table).values(id=fixture_id, payload_json=fixture))
            if is_settled:
                outcome = (
                    "home_win"
                    if home_score > away_score
                    else "away_win"
                    if away_score > home_score
                    else "draw"
                )
                session.execute(
                    insert(fixture_results_table).values(
                        id=f"result-{fixture_id}",
                        payload_json={
                            "fixture_id": fixture_id,
                            "home_score": home_score,
                            "away_score": away_score,
                            "outcome": outcome,
                            "finalised": True,
                            "synthetic": False,
                            "finalised_at": now,
                        },
                    )
                )
                session.execute(
                    insert(fixture_scoring_snapshots_table).values(
                        id=f"snapshot-{fixture_id}",
                        payload_json={
                            "fixture_id": fixture_id,
                            "scoring_lineup_goals": {home: home_goals, away: away_goals},
                            "finalised_at": now,
                            "synthetic": False,
                        },
                    )
                )
        session.commit()
    return session_factory, PostgreSQLLeagueRepository(session_factory)


def test_knockout_schedule_persists_seeds_progression_and_unresolved_ties() -> None:
    session_factory, repository = _repository_with_playoffs()

    snapshot = repository.get_knockout_snapshot()
    top_four = next(bracket for bracket in snapshot.brackets if bracket.id == "top-four")
    bottom_two = next(bracket for bracket in snapshot.brackets if bracket.id == "bottom-two")
    ties = {tie.id: tie for tie in top_four.ties}

    assert {tie_id: [team.id for team in tie.teams] for tie_id, tie in ties.items()} == {
        "top-four-semi-1": ["a", "d"],
        "top-four-semi-2": ["b", "c"],
        "top-four-final": ["a", "b"],
        "top-four-third-place": ["d", "c"],
    }
    assert ties["top-four-semi-1"].winner.id == "a"
    assert ties["top-four-semi-2"].winner.id == "b"
    assert ties["top-four-semi-1"].expected_legs == 2
    assert ties["top-four-semi-1"].start_gameweek == 36
    assert ties["top-four-final"].winner is None
    assert ties["top-four-final"].expected_legs == 1
    assert ties["top-four-final"].start_gameweek == 38
    assert len(ties["top-four-final"].legs) == 1
    bottom_final = bottom_two.ties[0]
    assert [team.id for team in bottom_final.teams] == ["c", "d"]
    assert bottom_final.expected_legs == 2
    assert bottom_final.start_gameweek == 37
    assert bottom_final.tiebreak_status == "unresolved_aggregate_and_goals_tie"
    assert bottom_final.winner is None
    assert snapshot.unconfigured_brackets == ["middle"]
    with session_factory() as session:
        persisted = list(session.execute(select(knockout_matches_table.c.payload_json)).scalars())
    assert {row["tie_id"] for row in persisted if row.get("record_type") == "tie"} == {
        "top-four-semi-1",
        "top-four-semi-2",
        "top-four-final",
        "top-four-third-place",
        "bottom-two-final",
    }


def test_knockout_seed_creates_pending_playoff_fixtures_when_schedule_is_absent() -> None:
    session_factory, repository = _repository_with_playoffs(include_scheduled_legs=False)

    snapshot = repository.get_knockout_snapshot()

    top_four = next(bracket for bracket in snapshot.brackets if bracket.id == "top-four")
    bottom_two = next(bracket for bracket in snapshot.brackets if bracket.id == "bottom-two")
    assert sum(len(tie.legs) for tie in top_four.ties) == 4
    assert len(bottom_two.ties[0].legs) == 2
    with session_factory() as session:
        fixtures = list(session.execute(select(cdl_fixtures_table.c.payload_json)).scalars())
    generated = [fixture for fixture in fixtures if fixture["id"].startswith("knockout-")]
    assert len(generated) == 6
    assert all(fixture["status"] == "pending" for fixture in generated)
    assert all(fixture["synthetic"] is False for fixture in generated)
