from types import TracebackType
from typing import Self

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql.dml import Delete, Insert

from cdl_api.app import create_app
from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.league_models import (
    FixtureOutcome,
    FixtureScore,
    FixtureStatus,
    LeagueFixture,
)
from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository
from cdl_api.routers.team_selection import get_team_selection_repository


class _Result:
    def mappings(self) -> list[dict[str, object]]:
        return []


class _CapturingSession:
    def __init__(self) -> None:
        self.statements: list[object] = []

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        return None

    def execute(self, statement: object) -> _Result:
        self.statements.append(statement)
        return _Result()

    def commit(self) -> None:
        return None


def _client_with_postgres_repo(session: _CapturingSession) -> TestClient:
    app = create_app()
    repository = PostgreSQLTeamSelectionRepository(lambda: session)
    repository.get_players = InMemoryTeamSelectionRepository().get_players
    app.dependency_overrides[get_team_selection_repository] = lambda: repository
    return TestClient(app)


def _valid_payload() -> dict[str, object]:
    return {
        "players": [
            {"player_id": "player-1", "slot": "starter", "slot_order": 1},
            {"player_id": "player-2", "slot": "starter", "slot_order": 2},
            {
                "player_id": "player-3",
                "slot": "starter",
                "slot_order": 3,
                "is_captain": True,
            },
            {
                "player_id": "player-4",
                "slot": "bench",
                "slot_order": 1,
                "is_vice_captain": True,
            },
            {"player_id": "player-5", "slot": "reserve", "slot_order": 1},
        ]
    }


def _statement_table_names(session: _CapturingSession, statement_type: type[object]) -> list[str]:
    return [
        statement.table.name
        for statement in session.statements
        if isinstance(statement, statement_type)
    ]


def test_postgres_team_selection_lineup_update_persists_slot_state() -> None:
    session = _CapturingSession()
    client = _client_with_postgres_repo(session)

    response = client.put("/api/team-selection/lineup", json=_valid_payload())

    assert response.status_code == 200
    assert "team_selection_lineup_slots" in _statement_table_names(session, Delete)
    assert _statement_table_names(session, Insert).count("team_selection_lineup_slots") == 5


def test_postgres_team_selection_invalid_lineup_does_not_persist() -> None:
    session = _CapturingSession()
    client = _client_with_postgres_repo(session)
    invalid_payload = _valid_payload()
    invalid_payload["players"] = invalid_payload["players"][:-1]

    response = client.put("/api/team-selection/lineup", json=invalid_payload)

    assert response.status_code == 422
    assert "lineup-validation" in {issue["rule_reference"] for issue in response.json()["issues"]}
    assert "team_selection_lineup_slots" not in _statement_table_names(session, Insert)


def test_postgres_team_selection_chip_update_persists_chip_state() -> None:
    session = _CapturingSession()
    client = _client_with_postgres_repo(session)

    response = client.put("/api/team-selection/chips/triple-captain", json={"active": True})

    assert response.status_code == 200
    assert "team_selection_chips" in _statement_table_names(session, Delete)
    assert _statement_table_names(session, Insert).count("team_selection_chips") == 5


def test_postgres_team_selection_invalid_chip_update_is_rejected() -> None:
    session = _CapturingSession()
    client = _client_with_postgres_repo(session)

    response = client.put("/api/team-selection/chips/bench-boost", json={"active": True})

    assert response.status_code == 422
    assert response.json()["issues"][0]["rule_reference"] == "chip-usage"
    assert "team_selection_chips" not in _statement_table_names(session, Insert)


def test_postgres_fixture_summary_preserves_cross_feature_context() -> None:
    session = _CapturingSession()
    client = _client_with_postgres_repo(session)

    response = client.get("/api/team-selection/fixtures-summary")

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "cdl_fixtures": [],
        "epl_fixtures": [],
        "cdl_table": [],
        "epl_table": [],
    }


def test_postgres_team_selection_fixture_lock_is_persisted() -> None:
    session = _CapturingSession()
    repository = PostgreSQLTeamSelectionRepository(lambda: session)

    lock_id = repository.save_fixture_lock(
        fixture_id="fixture-1",
        fixture_type="epl",
        lock_scope="gameweek",
        reason="FPL deadline passed.",
    )

    assert lock_id.startswith("fixture-lock-")
    assert "team_selection_fixture_locks" in _statement_table_names(session, Insert)


def test_postgres_historical_fixture_squads_use_locked_lineup_and_event_points() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE fpl_players ("
                "id TEXT PRIMARY KEY, web_name TEXT NOT NULL, "
                "position_id TEXT NOT NULL, team_id TEXT NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE epl_teams ("
                "id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE external_payload_cache ("
                "resource TEXT PRIMARY KEY, payload_json JSON NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE fixture_scoring_snapshots ("
                "id TEXT PRIMARY KEY, payload_json JSON NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE team_selection_lineup_slots ("
                "id TEXT PRIMARY KEY, season_id TEXT NOT NULL, "
                "draft_team_id TEXT NOT NULL, player_id TEXT NOT NULL, "
                "gameweek INTEGER NOT NULL, slot TEXT NOT NULL, "
                "slot_order INTEGER NOT NULL, is_captain BOOLEAN NOT NULL, "
                "is_vice_captain BOOLEAN NOT NULL)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO epl_teams (id, name, short_name) VALUES "
                "('epl-ars', 'Arsenal', 'ARS'), ('epl-che', 'Chelsea', 'CHE')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO fpl_players "
                "(id, web_name, position_id, team_id) VALUES "
                "('fpl-1', 'Keeper One', 'GKP', 'epl-ars'), "
                "('fpl-2', 'Forward Two', 'FWD', 'epl-che'), "
                "('fpl-3', 'Keeper Three', 'GKP', 'epl-ars'), "
                "('fpl-4', 'Forward Four', 'FWD', 'epl-che')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO external_payload_cache "
                "(resource, payload_json) VALUES ('event-live:1', :payload)"
            ),
            {
                "payload": (
                    '{"elements": [{"id": 1, "stats": {"total_points": 8}}, '
                    '{"id": 2, "stats": {"total_points": 5}}, '
                    '{"id": 3, "stats": {"total_points": 3}}, '
                    '{"id": 4, "stats": {"total_points": 7}}]}'
                )
            },
        )
        connection.execute(
            text(
                "INSERT INTO team_selection_lineup_slots "
                "(id, season_id, draft_team_id, player_id, gameweek, slot, "
                "slot_order, is_captain, is_vice_captain) VALUES "
                "(:id, :season, :team, :player, 1, :slot, :order, :captain, 0)"
            ),
            [
                {
                    "id": "lineup-home-1",
                    "season": "season-cdl-2026-27",
                    "team": "team-home",
                    "player": "fpl-1",
                    "slot": "starter",
                    "order": 1,
                    "captain": True,
                },
                {
                    "id": "lineup-home-2",
                    "season": "season-cdl-2026-27",
                    "team": "team-home",
                    "player": "fpl-2",
                    "slot": "bench",
                    "order": 2,
                    "captain": False,
                },
                {
                    "id": "lineup-away-1",
                    "season": "season-cdl-2026-27",
                    "team": "team-away",
                    "player": "fpl-3",
                    "slot": "starter",
                    "order": 1,
                    "captain": False,
                },
                {
                    "id": "lineup-away-2",
                    "season": "season-cdl-2026-27",
                    "team": "team-away",
                    "player": "fpl-4",
                    "slot": "bench",
                    "order": 2,
                    "captain": False,
                },
            ],
        )

    sessions = sessionmaker(bind=engine, class_=Session)
    repository = object.__new__(PostgreSQLTeamSelectionRepository)
    repository._session_factory = sessions
    repository.manager_team = TeamSummary(id="team-home", name="Home")
    fixture = LeagueFixture(
        id="fixture-history-1",
        gameweek=GameweekSummary(id="gw-1", name="Gameweek 1", number=1),
        home_team=TeamSummary(id="team-home", name="Home"),
        away_team=TeamSummary(id="team-away", name="Away"),
        status=FixtureStatus.COMPLETE,
        kickoff_label="Gameweek 1",
        round_label="Regular season",
        score=FixtureScore(home_score=8, away_score=3, outcome=FixtureOutcome.HOME_WIN),
    )

    squads = repository.get_historical_fixture_squads(fixture)

    assert [squad.team.id for squad in squads] == ["team-home", "team-away"]
    assert squads[0].starters[0].display_name == "Keeper One"
    assert squads[0].starters[0].points == 8
    assert squads[0].bench[0].points == 5
    assert squads[0].starters[0].is_captain is True
