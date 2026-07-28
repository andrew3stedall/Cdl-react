import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.postgres_squad import (
    squad_interests_table,
    trade_assets_table,
    trade_proposals_table,
)
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.routers.squad import get_squad_service, require_manager_session
from cdl_api.services.squad import SquadManagementService


def _seed_prerequisites(connection: Connection) -> None:
    statements = (
        """
        INSERT INTO leagues (id, name, code)
        VALUES ('league-squad-test', 'Squad Test', 'SQUAD-TEST')
        ON CONFLICT (id) DO NOTHING
        """,
        """
        INSERT INTO seasons (id, league_id, name, start_gameweek, end_gameweek)
        VALUES ('season-2026', 'league-squad-test', '2026', 1, 38)
        ON CONFLICT (id) DO NOTHING
        """,
        """
        INSERT INTO managers (id, display_name)
        VALUES
            ('manager-1', 'Manager'),
            ('manager-rival', 'Rival Manager')
        ON CONFLICT (id) DO NOTHING
        """,
        """
        INSERT INTO draft_teams (id, league_id, manager_id, name)
        VALUES
            ('team-castle', 'league-squad-test', 'manager-1', 'Castle FC'),
            ('team-rival', 'league-squad-test', 'manager-rival', 'Rival Town')
        ON CONFLICT (id) DO NOTHING
        """,
        """
        INSERT INTO fpl_positions (id, singular_name, plural_name)
        VALUES
            ('GKP-TRADE', 'Trade goalkeeper', 'Trade goalkeepers'),
            ('MID-INT', 'Interest midfielder', 'Interest midfielders'),
            ('FWD-TRADE', 'Trade forward', 'Trade forwards')
        ON CONFLICT (id) DO NOTHING
        """,
        """
        INSERT INTO epl_teams (id, short_name, name)
        VALUES
            ('epl-ars', 'ARS', 'Arsenal'),
            ('epl-mci', 'MCI', 'Manchester City')
        ON CONFLICT (id) DO NOTHING
        """,
        """
        INSERT INTO fpl_players (
            id, first_name, second_name, web_name, position_id, team_id
        )
        VALUES
            ('player-1', 'Alex', 'Keeper', 'Alex', 'GKP-TRADE', 'epl-ars'),
            ('player-3', 'Casey', 'Midfielder', 'Casey', 'MID-INT', 'epl-ars'),
            ('player-4', 'Dev', 'Forward', 'Dev', 'FWD-TRADE', 'epl-mci')
        ON CONFLICT (id) DO NOTHING
        """,
    )
    for statement in statements:
        connection.execute(text(statement))


def _clean_prerequisites(connection: Connection) -> None:
    statements = (
        "DELETE FROM fpl_players WHERE id IN ('player-1', 'player-3', 'player-4')",
        "DELETE FROM fpl_positions WHERE id IN ('GKP-TRADE', 'MID-INT', 'FWD-TRADE')",
        "DELETE FROM epl_teams WHERE id IN ('epl-ars', 'epl-mci')",
        "DELETE FROM draft_teams WHERE id IN ('team-castle', 'team-rival')",
        "DELETE FROM managers WHERE id IN ('manager-1', 'manager-rival')",
        "DELETE FROM seasons WHERE id = 'season-2026'",
        "DELETE FROM leagues WHERE id = 'league-squad-test'",
    )
    for statement in statements:
        connection.execute(text(statement))


def _authenticated_client(
    repository: PostgreSQLSquadRepository,
    active_manager: dict[str, str] | None = None,
) -> TestClient:
    manager = active_manager or {"id": "manager-1"}
    app = create_app()
    service = SquadManagementService(repository)
    app.dependency_overrides[get_squad_service] = lambda: service
    app.dependency_overrides[require_manager_session] = lambda: SessionUser(
        id=manager["id"],
        email="manager@example.com",
        display_name="Manager",
        roles=["manager"],
    )
    return TestClient(app)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_authenticated_interest_persists_and_rejection_leaves_state_unchanged() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM squad_interests"))
        _seed_prerequisites(connection)

    repository = PostgreSQLSquadRepository(session_factory)
    client = _authenticated_client(repository)

    try:
        created = client.post(
            "/api/interests",
            json={"player_id": "player-3", "note": "Watch"},
        )
        assert created.status_code == 200
        interest_id = created.json()["id"]
        listed_ids = [row["id"] for row in client.get("/api/interests").json()]
        assert listed_ids == [interest_id]

        duplicate = client.post("/api/interests", json={"player_id": "player-3"})
        assert duplicate.status_code == 422
        assert duplicate.json()["message"] == "Interest already exists."

        with session_factory() as session:
            count = session.execute(
                select(func.count()).select_from(squad_interests_table)
            ).scalar_one()
            player_query = select(squad_interests_table.c.player_id)
            stored_player = session.execute(player_query).scalar_one()
        assert count == 1
        assert stored_player == "player-3"
    finally:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM squad_interests"))
            _clean_prerequisites(connection)


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_authenticated_trade_persists_and_rejection_leaves_state_unchanged() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(bind=engine, class_=Session)
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM trade_assets"))
        connection.execute(text("DELETE FROM trade_proposals"))
        _seed_prerequisites(connection)

    repository = PostgreSQLSquadRepository(session_factory)
    active_manager = {"id": "manager-1"}
    client = _authenticated_client(repository, active_manager)

    try:
        created = client.post(
            "/api/trades",
            json={
                "offered_to_team_id": "team-rival",
                "offered_player_ids": ["player-1"],
                "requested_player_ids": ["player-4"],
            },
        )
        assert created.status_code == 200
        trade_id = created.json()["id"]
        listed = client.get("/api/trades")
        assert [trade["id"] for trade in listed.json()["trades"]] == [trade_id]

        invalid = client.post(
            "/api/trades",
            json={
                "offered_to_team_id": "team-rival",
                "offered_player_ids": ["player-3"],
                "requested_player_ids": ["player-4"],
            },
        )
        assert invalid.status_code == 422
        assert invalid.json()["message"] == "Invalid trade asset."

        unauthorized = client.put(
            f"/api/trades/{trade_id}",
            json={"status": "accepted"},
        )
        assert unauthorized.status_code == 422
        assert unauthorized.json()["message"] == "Trade transition is not authorized."

        active_manager["id"] = "manager-rival"
        accepted = client.put(
            f"/api/trades/{trade_id}",
            json={"status": "accepted"},
        )
        assert accepted.status_code == 200
        assert accepted.json()["status"] == "accepted"

        stale = client.put(
            f"/api/trades/{trade_id}",
            json={"status": "rejected"},
        )
        assert stale.status_code == 422
        assert stale.json()["message"] == "Trade is no longer pending."

        with session_factory() as session:
            proposal_count = session.execute(
                select(func.count()).select_from(trade_proposals_table)
            ).scalar_one()
            asset_count = session.execute(
                select(func.count()).select_from(trade_assets_table)
            ).scalar_one()
            stored_status = session.execute(select(trade_proposals_table.c.status)).scalar_one()
        assert proposal_count == 1
        assert asset_count == 2
        assert stored_status == "accepted"
    finally:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM trade_assets"))
            connection.execute(text("DELETE FROM trade_proposals"))
            _clean_prerequisites(connection)
