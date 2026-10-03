"""Check owner isolation, round-trip notes and league-scoped history."""

import os
from collections.abc import Iterator
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.contracts.scouting import ScoutingNoteUpdate
from cdl_api.repositories.private_scouting import PrivateScoutingRepository, private_scouting_table


@pytest.fixture
def database() -> Iterator[sessionmaker[Session]]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    private_scouting_table.create(engine)
    with engine.begin() as connection:
        for ddl in (
            "CREATE TABLE users (id TEXT PRIMARY KEY)",
            "CREATE TABLE fpl_players (id TEXT PRIMARY KEY)",
            "CREATE TABLE draft_teams (id TEXT PRIMARY KEY, league_id TEXT, name TEXT)",
            "CREATE TABLE seasons (id TEXT PRIMARY KEY, league_id TEXT, name TEXT)",
            "CREATE TABLE squad_ownerships (id TEXT PRIMARY KEY, season_id TEXT, "
            "draft_team_id TEXT, player_id TEXT, started_at TIMESTAMP, ended_at TIMESTAMP)",
        ):
            connection.execute(text(ddl))
        connection.execute(text("INSERT INTO users VALUES ('one'), ('two')"))
        connection.execute(text("INSERT INTO fpl_players VALUES ('player')"))
        connection.execute(
            text(
                "INSERT INTO draft_teams VALUES ('team', 'league', 'Home'), "
                "('other-team', 'other', 'Elsewhere')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO seasons VALUES ('season', 'league', '2026'), "
                "('other-season', 'other', '2026')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO squad_ownerships VALUES "
                "('mine', 'season', 'team', 'player', '2026-01-01 00:00:00', NULL), "
                "('theirs', 'other-season', 'other-team', 'player', '2026-01-01 00:00:00', NULL)"
            )
        )
    yield sessionmaker(engine)
    engine.dispose()


def test_private_notes_round_trip_without_leaking_to_another_user(
    database: sessionmaker[Session],
) -> None:
    one = PrivateScoutingRepository(database, "one", "league")
    two = PrivateScoutingRepository(database, "two", "league")
    one.save_note("player", ScoutingNoteUpdate(watchlisted=True, note="  My private plan  "))
    assert one.get_note("player").note == "My private plan"
    assert [item.player_id for item in one.list_watchlist()] == ["player"]
    assert two.get_note("player").note == ""
    assert two.list_watchlist() == []
    one.save_note("player", ScoutingNoteUpdate(watchlisted=False, note="Keep my note"))
    assert one.list_watchlist() == []
    assert one.get_note("player").note == "Keep my note"
    one.save_note("player", ScoutingNoteUpdate())
    assert one.get_note("player").updated_at is None


def test_history_never_includes_another_leagues_ownership(database: sessionmaker[Session]) -> None:
    repository = PrivateScoutingRepository(database, "one", "league")
    assert [period.id for period in repository.ownership_history("player").periods] == ["mine"]
    with pytest.raises(LookupError):
        repository.save_note("unknown", ScoutingNoteUpdate(watchlisted=True))


@pytest.mark.skipif(not os.getenv("CDL_DATABASE_URL"), reason="Requires migrated PostgreSQL")
def test_postgres_private_note_isolation_and_cleanup() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    factory = sessionmaker(engine)
    suffix = uuid4().hex[:12]
    user_one, user_two = f"scout-{suffix}-1", f"scout-{suffix}-2"
    player, position, club = f"scout-player-{suffix}", f"s-{suffix}", f"scout-club-{suffix}"
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO fpl_positions (id,singular_name,plural_name) "
                "VALUES (:id,'Defender','Defenders')"
            ),
            {"id": position},
        )
        connection.execute(
            text("INSERT INTO epl_teams (id,short_name,name) VALUES (:id,'SC','Scouting club')"),
            {"id": club},
        )
        connection.execute(
            text(
                "INSERT INTO fpl_players (id,first_name,second_name,web_name,position_id,team_id) "
                "VALUES (:id,'Private','Player','Private Player',:position,:club)"
            ),
            {"id": player, "position": position, "club": club},
        )
        for user in (user_one, user_two):
            connection.execute(
                text(
                    "INSERT INTO users (id,email,display_name,roles) "
                    "VALUES (:id,:email,'Scouting test','[\"manager\"]')"
                ),
                {"id": user, "email": f"{user}@example.test"},
            )
    try:
        one = PrivateScoutingRepository(factory, user_one, "unused")
        two = PrivateScoutingRepository(factory, user_two, "unused")
        one.save_note(str(player), ScoutingNoteUpdate(watchlisted=True, note="Private"))
        assert one.get_note(str(player)).note == "Private"
        assert two.get_note(str(player)).note == ""
        assert two.list_watchlist() == []
        one.save_note(str(player), ScoutingNoteUpdate())
        assert one.list_watchlist() == []
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM private_player_scouting WHERE user_id IN (:one,:two)"),
                {"one": user_one, "two": user_two},
            )
            connection.execute(
                text("DELETE FROM users WHERE id IN (:one,:two)"),
                {"one": user_one, "two": user_two},
            )
            connection.execute(text("DELETE FROM fpl_players WHERE id=:id"), {"id": player})
            connection.execute(text("DELETE FROM fpl_positions WHERE id=:id"), {"id": position})
            connection.execute(text("DELETE FROM epl_teams WHERE id=:id"), {"id": club})
        engine.dispose()
