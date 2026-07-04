from types import TracebackType
from typing import Self

from fastapi.testclient import TestClient
from sqlalchemy.sql.dml import Delete, Insert

from cdl_api.app import create_app
from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository
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

    response = client.put("/api/team-selection/chips/wildcard", json={"active": True})

    assert response.status_code == 200
    assert "team_selection_chips" in _statement_table_names(session, Delete)
    assert _statement_table_names(session, Insert).count("team_selection_chips") == 3


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
    assert payload["cdl_fixtures"][0]["home_team"]["id"] == "team-castle"
    assert payload["epl_fixtures"][0]["home_team"]["id"] == "epl-ars"
    assert payload["cdl_table"][0]["id"] == "team-castle"
