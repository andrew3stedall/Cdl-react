from types import TracebackType
from typing import Self

from fastapi.testclient import TestClient
from sqlalchemy.sql.dml import Insert, Update

from cdl_api.app import create_app
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.routers.squad import get_squad_service
from cdl_api.services.squad import SquadManagementService


class _Result:
    def __init__(self, rowcount: int = 1) -> None:
        self.rowcount = rowcount

    def scalars(self) -> list[str]:
        return []

    def mappings(self) -> Self:
        return self

    def first(self) -> None:
        return None


class _CapturingSession:
    def __init__(self, rowcount: int = 1) -> None:
        self.rowcount = rowcount
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
        return _Result(rowcount=self.rowcount)

    def commit(self) -> None:
        return None


def _client_with_postgres_repo(session: _CapturingSession) -> TestClient:
    app = create_app()
    repository = PostgreSQLSquadRepository(lambda: session)
    app.dependency_overrides[get_squad_service] = lambda: SquadManagementService(repository)
    return TestClient(app)


def _statement_table_names(session: _CapturingSession, statement_type: type[object]) -> list[str]:
    return [
        statement.table.name
        for statement in session.statements
        if isinstance(statement, statement_type)
    ]


def test_interest_api_persists_with_postgres_squad_repository() -> None:
    session = _CapturingSession()
    client = _client_with_postgres_repo(session)

    response = client.post("/api/interests", json={"player_id": "player-3", "note": "Scout"})

    assert response.status_code == 200
    assert "squad_interests" in _statement_table_names(session, Insert)


def test_trade_api_persists_with_postgres_squad_repository() -> None:
    session = _CapturingSession()
    client = _client_with_postgres_repo(session)

    response = client.post(
        "/api/trades",
        json={
            "offered_to_team_id": "team-rival",
            "offered_player_ids": ["player-1"],
            "requested_player_ids": ["player-4"],
        },
    )

    assert response.status_code == 200
    table_names = _statement_table_names(session, Insert)
    assert "trade_proposals" in table_names
    assert table_names.count("trade_assets") == 2


def test_postgres_squad_api_validation_failures_are_preserved() -> None:
    session = _CapturingSession()
    client = _client_with_postgres_repo(session)

    owned_interest = client.post("/api/interests", json={"player_id": "player-1"})
    bad_trade = client.post(
        "/api/trades",
        json={
            "offered_to_team_id": "team-rival",
            "offered_player_ids": ["player-3"],
            "requested_player_ids": ["player-4"],
        },
    )
    unknown_player = client.post("/api/interests", json={"player_id": "unknown-player"})

    assert owned_interest.status_code == 422
    assert owned_interest.json()["issues"][0]["rule_reference"] == "squad-size"
    assert bad_trade.status_code == 422
    assert bad_trade.json()["issues"][0]["field"] == "offered_player_ids"
    assert unknown_player.status_code == 422
    assert unknown_player.json()["issues"][0]["message"] == "Unknown player."


def test_missing_trade_update_returns_not_found_with_postgres_squad_repository() -> None:
    session = _CapturingSession(rowcount=0)
    client = _client_with_postgres_repo(session)

    response = client.put("/api/trades/missing-trade", json={"status": "accepted"})

    assert response.status_code == 404
    assert response.json()["details"]["trade_id"] == "missing-trade"
    assert "trade_proposals" in _statement_table_names(session, Update)
