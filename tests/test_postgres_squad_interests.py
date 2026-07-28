import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.postgres_squad import squad_interests_table
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
        VALUES ('manager-1', 'Manager')
        ON CONFLICT (id) DO NOTHING
        """,
        """
        INSERT INTO draft_teams (id, league_id, manager_id, name)
        VALUES ('team-castle', 'league-squad-test', 'manager-1', 'Castle FC')
        ON CONFLICT (id) DO NOTHING
        """,
        """
        INSERT INTO fpl_positions (id, singular_name, plural_name)
        VALUES ('MID', 'Midfielder', 'Midfielders')
        ON CONFLICT (id) DO NOTHING
        """,
        """
        INSERT INTO epl_teams (id, short_name, name)
        VALUES ('epl-ars', 'ARS', 'Arsenal')
        ON CONFLICT (id) DO NOTHING
        """,
        """
        INSERT INTO fpl_players (
            id, first_name, second_name, web_name, position_id, team_id
        )
        VALUES ('player-3', 'Casey', 'Midfielder', 'Casey', 'MID', 'epl-ars')
        ON CONFLICT (id) DO NOTHING
        """,
    )
    for statement in statements:
        connection.execute(text(statement))


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
    app = create_app()
    service = SquadManagementService(repository)
    app.dependency_overrides[get_squad_service] = lambda: service
    app.dependency_overrides[require_manager_session] = lambda: SessionUser(
        id="manager-1",
        email="manager@example.com",
        display_name="Manager",
        roles=["manager"],
    )
    client = TestClient(app)

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
