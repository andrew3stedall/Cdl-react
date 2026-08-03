from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.repositories.postgres_league_fpl import draft_teams_table, fpl_players_table
from cdl_api.repositories.postgres_squad import squad_ownerships_table
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.staging_draft_seed import (
    PRIMARY_TEAM_ID,
    TEAM_IDS,
    draft_board,
    seed_staging_snake_draft,
    snake_team_index,
)


def test_canonical_board_has_160_unique_contiguous_players() -> None:
    players = draft_board()

    assert len(players) == 160
    assert [player.rank for player in players] == list(range(1, 161))
    assert len({player.fpl_id for player in players}) == 160
    assert players[0].name == "Haaland"
    assert players[-1].name == "Struijk"


def test_snake_allocation_gives_every_team_20_players() -> None:
    team_indexes = [snake_team_index(pick) for pick in range(1, 161)]

    assert team_indexes[:8] == list(range(8))
    assert team_indexes[8:16] == list(reversed(range(8)))
    assert team_indexes[16:24] == list(range(8))
    assert [team_indexes.count(index) for index in range(len(TEAM_IDS))] == [20] * 8


def test_seed_is_idempotent_and_postgres_repository_reads_it() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    statements = (
        """CREATE TABLE users (
            id TEXT PRIMARY KEY, email TEXT UNIQUE, display_name TEXT, roles JSON
        )""",
        "CREATE TABLE leagues (id TEXT PRIMARY KEY, name TEXT, code TEXT UNIQUE)",
        """CREATE TABLE seasons (
            id TEXT PRIMARY KEY, league_id TEXT, name TEXT,
            start_gameweek INTEGER, end_gameweek INTEGER
        )""",
        "CREATE TABLE managers (id TEXT PRIMARY KEY, user_id TEXT, display_name TEXT)",
        """CREATE TABLE draft_teams (
            id TEXT PRIMARY KEY, league_id TEXT, manager_id TEXT, name TEXT
        )""",
        """CREATE TABLE league_memberships (
            id TEXT PRIMARY KEY, league_id TEXT, manager_id TEXT, role TEXT
        )""",
        "CREATE TABLE fpl_positions (id TEXT PRIMARY KEY, singular_name TEXT, plural_name TEXT)",
        "CREATE TABLE epl_teams (id TEXT PRIMARY KEY, short_name TEXT, name TEXT)",
        """CREATE TABLE fpl_players (
            id TEXT PRIMARY KEY, first_name TEXT, second_name TEXT, web_name TEXT,
            position_id TEXT, team_id TEXT
        )""",
        """CREATE TABLE squad_roster_slots (
            id TEXT PRIMARY KEY, season_id TEXT, draft_team_id TEXT, slot_key TEXT,
            position_id TEXT, sort_order INTEGER, is_required BOOLEAN
        )""",
        """CREATE TABLE squad_ownerships (
            id TEXT PRIMARY KEY, season_id TEXT, draft_team_id TEXT, player_id TEXT,
            roster_slot_id TEXT, started_at DATETIME, ended_at DATETIME
        )""",
        """CREATE TABLE squad_interests (
            id TEXT PRIMARY KEY, season_id TEXT, draft_team_id TEXT, manager_id TEXT,
            player_id TEXT, gameweek INTEGER, status TEXT, note TEXT,
            created_at DATETIME, updated_at DATETIME
        )""",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(
            text(
                "INSERT INTO users (id, email, display_name, roles) "
                "VALUES ('google:test', 'andrew3stedall@gmail.com', 'Andrew', '[]')"
            )
        )
    session_factory = sessionmaker(bind=engine, class_=Session)

    first = seed_staging_snake_draft(session_factory)
    second = seed_staging_snake_draft(session_factory)

    assert first == second
    with session_factory() as session:
        assert (
            session.execute(select(func.count()).select_from(draft_teams_table)).scalar_one() == 8
        )
        assert (
            session.execute(select(func.count()).select_from(fpl_players_table)).scalar_one() == 160
        )
        team_counts = dict(
            session.execute(
                select(
                    squad_ownerships_table.c.draft_team_id,
                    func.count(),
                ).group_by(squad_ownerships_table.c.draft_team_id)
            ).all()
        )
    assert team_counts == {team_id: 20 for team_id in TEAM_IDS}

    repository = PostgreSQLSquadRepository(session_factory)
    summary_players = [
        player
        for player in repository.list_squad_players()
        if player.draft_team is not None and player.draft_team.id == PRIMARY_TEAM_ID
    ]
    assert len(summary_players) == 20
    assert summary_players[0].display_name == "Haaland"
