import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.contracts.free_agency import (
    FreeAgencyDrawCreateRequest,
    FreeAgencyDrawStatus,
    FreeAgencyPreferencesRequest,
)
from cdl_api.repositories.free_agency_draws import PostgreSQLFreeAgencyDrawRepository
from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository
from cdl_api.services.live_draft import LiveDraftError
from cdl_api.staging_draft_seed import LEAGUE_ID, SEASON_ID


@pytest.fixture
def draw_database(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[Engine, sessionmaker[Session]]]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    session_factory = sessionmaker(engine)
    ddl = (
        """CREATE TABLE managers (
            id TEXT PRIMARY KEY, user_id TEXT, display_name TEXT
        )""",
        "CREATE TABLE seasons (id TEXT PRIMARY KEY)",
        "CREATE TABLE live_drafts (id TEXT PRIMARY KEY, season_id TEXT, status TEXT)",
        """CREATE TABLE league_memberships (
            id TEXT PRIMARY KEY, league_id TEXT, manager_id TEXT, role TEXT
        )""",
        """CREATE TABLE draft_teams (
            id TEXT PRIMARY KEY, league_id TEXT, manager_id TEXT, name TEXT
        )""",
        """CREATE TABLE fpl_positions (
            id TEXT PRIMARY KEY, singular_name TEXT
        )""",
        """CREATE TABLE fpl_players (
            id TEXT PRIMARY KEY, web_name TEXT, position_id TEXT
        )""",
        "CREATE TABLE loans (season_id TEXT, player_id TEXT, lender_team_id TEXT, status TEXT)",
        """CREATE TABLE fpl_gameweeks (
            id TEXT PRIMARY KEY, deadline_time TIMESTAMP
        )""",
        """CREATE TABLE squad_ownerships (
            id TEXT PRIMARY KEY, season_id TEXT, draft_team_id TEXT, player_id TEXT,
            roster_slot_id TEXT, started_at TIMESTAMP, ended_at TIMESTAMP
        )""",
        """CREATE TABLE squad_roster_slots (
            id TEXT PRIMARY KEY, season_id TEXT, draft_team_id TEXT, slot_key TEXT,
            position_id TEXT, sort_order INTEGER
        )""",
        """CREATE TABLE player_rights (
            id TEXT PRIMARY KEY, season_id TEXT, draft_team_id TEXT, player_id TEXT,
            right_type TEXT, source_ref TEXT, acquired_at TIMESTAMP,
            expires_at TIMESTAMP, released_at TIMESTAMP
        )""",
        """CREATE TABLE free_agency_draws (
            id TEXT PRIMARY KEY, season_id TEXT, gameweek INTEGER, status TEXT,
            opens_at TIMESTAMP, closes_at TIMESTAMP, processed_at TIMESTAMP,
            created_at TIMESTAMP
        )""",
        """CREATE TABLE free_agency_draw_order (
            id TEXT PRIMARY KEY, draw_id TEXT, draft_team_id TEXT, position INTEGER
        )""",
        """CREATE TABLE free_agency_preferences (
            id TEXT PRIMARY KEY, draw_id TEXT, draft_team_id TEXT,
            manager_id TEXT, player_id TEXT, rank INTEGER, submitted_at TIMESTAMP
        )""",
        """CREATE TABLE free_agency_results (
            id TEXT PRIMARY KEY, draw_id TEXT, draft_team_id TEXT, player_id TEXT,
            preference_rank INTEGER, reason_code TEXT, temporary_right_id TEXT,
            created_at TIMESTAMP
        )""",
        """CREATE TABLE free_agency_events (
            id TEXT PRIMARY KEY, draw_id TEXT, actor_manager_id TEXT,
            action TEXT, created_at TIMESTAMP, metadata_json JSON
        )""",
    )
    with engine.begin() as connection:
        for statement in ddl:
            connection.execute(text(statement))
        connection.execute(text("INSERT INTO seasons VALUES ('season-cdl-2026-27')"))
        connection.execute(
            text(
                "INSERT INTO managers VALUES "
                "('manager-a', 'user-a', 'A'), ('manager-b', 'user-b', 'B'), "
                "('manager-c', 'user-c', 'C')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO league_memberships VALUES "
                "('member-a', 'league-cdl-2026-27', 'manager-a', 'manager'), "
                "('member-b', 'league-cdl-2026-27', 'manager-b', 'manager'), "
                "('member-c', 'league-cdl-2026-27', 'manager-c', 'commissioner')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO draft_teams VALUES "
                "('team-a', 'league-cdl-2026-27', 'manager-a', 'A'), "
                "('team-b', 'league-cdl-2026-27', 'manager-b', 'B'), "
                "('team-c', 'league-cdl-2026-27', 'manager-c', 'C')"
            )
        )
        connection.execute(text("INSERT INTO fpl_positions VALUES ('DEF', 'Defender')"))
        connection.execute(
            text(
                "INSERT INTO squad_roster_slots VALUES "
                "('slot-a', 'season-cdl-2026-27', 'team-a', 'DEF-1', 'DEF', 1), "
                "('slot-b', 'season-cdl-2026-27', 'team-b', 'DEF-1', 'DEF', 1), "
                "('slot-c', 'season-cdl-2026-27', 'team-c', 'DEF-1', 'DEF', 1)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO fpl_players VALUES "
                "('p1', 'Player One', 'DEF'), ('p2', 'Player Two', 'DEF'), "
                "('p3', 'Player Three', 'DEF')"
            )
        )
        connection.execute(
            text("INSERT INTO fpl_gameweeks VALUES ('4', :deadline)"),
            {"deadline": datetime.now(UTC) + timedelta(days=1)},
        )
    monkeypatch.setattr(
        PostgreSQLTeamSelectionRepository,
        "repair_unlocked_lineups",
        staticmethod(lambda _session, _team_id, _owned_ids, _now: None),
        raising=False,
    )
    yield engine, session_factory
    engine.dispose()


def _repository(
    session_factory: sessionmaker[Session],
    user_id: str,
    manager_id: str,
    team_id: str,
) -> PostgreSQLFreeAgencyDrawRepository:
    return PostgreSQLFreeAgencyDrawRepository(session_factory, user_id, manager_id, team_id)


def test_ranked_draw_process_is_private_atomic_and_idempotent(
    draw_database: tuple[Engine, sessionmaker[Session]],
) -> None:
    engine, session_factory = draw_database
    now = datetime.now(UTC)
    commissioner = _repository(session_factory, "user-c", "manager-c", "team-c")
    team_a = _repository(session_factory, "user-a", "manager-a", "team-a")
    team_b = _repository(session_factory, "user-b", "manager-b", "team-b")
    draw = commissioner.create_draw(
        FreeAgencyDrawCreateRequest(
            gameweek=4,
            opens_at=now - timedelta(minutes=1),
            closes_at=now + timedelta(minutes=5),
        )
    )
    commissioner.set_draw_status(
        draw.id,
        FreeAgencyDrawStatus.OPEN_FOR_PREFERENCES,
        "draw_opened",
        FreeAgencyDrawStatus.SCHEDULED,
    )
    team_a.submit_preferences(draw.id, FreeAgencyPreferencesRequest(player_ids=["p1", "p2"]))
    team_b.submit_preferences(draw.id, FreeAgencyPreferencesRequest(player_ids=["p1", "p3"]))
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE free_agency_draws SET closes_at = :closed WHERE id = :draw_id"),
            {"closed": now - timedelta(seconds=1), "draw_id": draw.id},
        )
        connection.execute(
            text("INSERT INTO live_drafts VALUES ('draft-1', :season, 'active')"),
            {"season": SEASON_ID},
        )

    with pytest.raises(LiveDraftError, match="draft is in progress"):
        commissioner.process_draw(draw.id)
    with engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT status FROM free_agency_draws WHERE id = :id"), {"id": draw.id}
            ).scalar_one()
            == FreeAgencyDrawStatus.OPEN_FOR_PREFERENCES.value
        )
        result_count = connection.execute(
            text("SELECT COUNT(*) FROM free_agency_results")
        ).scalar_one()
        assert result_count == 0
    with engine.begin() as connection:
        connection.execute(text("UPDATE live_drafts SET status = 'complete'"))

    processed = commissioner.process_draw(draw.id)
    repeated = commissioner.process_draw(draw.id)
    private_a = team_a.results(draw.id)
    private_b = team_b.results(draw.id)

    assert processed is not None and processed.status == FreeAgencyDrawStatus.PROCESSED
    assert repeated is not None and repeated.draw_order == processed.draw_order
    with pytest.raises(ValueError, match="status changed"):
        commissioner.set_draw_status(
            draw.id,
            FreeAgencyDrawStatus.LOCKED,
            "draw_locked",
            FreeAgencyDrawStatus.OPEN_FOR_PREFERENCES,
        )
    assert private_a is not None and private_b is not None
    assert [preference.model_dump() for preference in private_a.own_preferences] == [
        {"player_id": "p1", "rank": 1},
        {"player_id": "p2", "rank": 2},
    ]
    assert [preference.model_dump() for preference in private_b.own_preferences] == [
        {"player_id": "p1", "rank": 1},
        {"player_id": "p3", "rank": 2},
    ]
    assert private_a.own_result is not None and private_b.own_result is not None
    assert {award.player_id for award in private_a.awards} == {
        private_a.own_result.won_player_id,
        private_b.own_result.won_player_id,
    }
    assert private_a.own_result.won_player_id != private_b.own_result.won_player_id
    with engine.connect() as connection:
        results = connection.execute(
            text("SELECT COUNT(*) FROM free_agency_results WHERE draw_id = :draw_id"),
            {"draw_id": draw.id},
        ).scalar_one()
        rights = connection.execute(
            text("SELECT COUNT(*) FROM player_rights WHERE source_ref = :draw_id"),
            {"draw_id": draw.id},
        ).scalar_one()
        active_ownerships = connection.execute(
            text("SELECT COUNT(*) FROM squad_ownerships WHERE ended_at IS NULL")
        ).scalar_one()
    assert results == 3
    assert rights == 2
    assert active_ownerships == 2


def test_preference_submission_rejects_duplicates_and_leaks_no_other_lists(
    draw_database: tuple[Engine, sessionmaker[Session]],
) -> None:
    _, session_factory = draw_database
    now = datetime.now(UTC)
    commissioner = _repository(session_factory, "user-c", "manager-c", "team-c")
    team_a = _repository(session_factory, "user-a", "manager-a", "team-a")
    draw = commissioner.create_draw(
        FreeAgencyDrawCreateRequest(gameweek=4, closes_at=now + timedelta(minutes=5))
    )
    commissioner.set_draw_status(
        draw.id,
        FreeAgencyDrawStatus.OPEN_FOR_PREFERENCES,
        "draw_opened",
        FreeAgencyDrawStatus.SCHEDULED,
    )

    with pytest.raises(ValueError, match="unique"):
        team_a.submit_preferences(draw.id, FreeAgencyPreferencesRequest(player_ids=["p1", "p1"]))
    assert team_a.preferences(draw.id) == []


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_postgres_ranked_draw_persists_private_results_and_claims_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from sqlalchemy import create_engine

    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(engine)
    suffix = uuid4().hex[:10]
    now = datetime.now(UTC)
    manager_a, manager_b, commissioner = (
        f"draw-a-{suffix}",
        f"draw-b-{suffix}",
        f"draw-c-{suffix}",
    )
    team_a, team_b, team_c = f"draw-ta-{suffix}", f"draw-tb-{suffix}", f"draw-tc-{suffix}"
    position_id = f"D{suffix[:8]}"
    player_a, player_b = f"draw-pa-{suffix}", f"draw-pb-{suffix}"
    slot_a, slot_b = f"draw-sa-{suffix}", f"draw-sb-{suffix}"
    draw_id = None
    seeded_gameweek_id = None
    monkeypatch.setattr(
        PostgreSQLTeamSelectionRepository,
        "repair_unlocked_lineups",
        staticmethod(lambda _session, _team_id, _owned_ids, _now: None),
    )
    try:
        with engine.begin() as connection:
            gameweek = connection.execute(
                text(
                    "SELECT gw.id FROM fpl_gameweeks gw "
                    "WHERE gw.deadline_time > :now AND NOT EXISTS ("
                    "SELECT 1 FROM free_agency_draws d "
                    "WHERE d.season_id = :season AND d.gameweek = CAST(gw.id AS INTEGER)) "
                    "ORDER BY gw.deadline_time LIMIT 1"
                ),
                {"now": now, "season": SEASON_ID},
            ).scalar_one_or_none()
            if gameweek is None:
                seeded_gameweek_id = f"9{suffix[:7]}"
                gameweek = seeded_gameweek_id
                close_at = now + timedelta(days=30)
                connection.execute(
                    text(
                        "INSERT INTO fpl_gameweeks "
                        "(id, name, deadline_time, is_previous, is_current, is_next, "
                        "finished, data_checked) "
                        "VALUES (:id, :name, :deadline, FALSE, FALSE, FALSE, FALSE, FALSE)"
                    ),
                    {
                        "id": seeded_gameweek_id,
                        "name": f"Draw test event {suffix}",
                        "deadline": close_at,
                    },
                )
            else:
                close_at = connection.execute(
                    text("SELECT deadline_time FROM fpl_gameweeks WHERE id = :id"),
                    {"id": gameweek},
                ).scalar_one()
            epl_team_id = connection.execute(text("SELECT id FROM epl_teams LIMIT 1")).scalar_one()
            league = connection.execute(
                text("SELECT id FROM leagues WHERE id = :id"), {"id": LEAGUE_ID}
            ).scalar_one()
            connection.execute(
                text("INSERT INTO managers (id, display_name) VALUES (:id, :name)"),
                [
                    {"id": manager_a, "name": "Draw A"},
                    {"id": manager_b, "name": "Draw B"},
                    {"id": commissioner, "name": "Draw Commissioner"},
                ],
            )
            connection.execute(
                text(
                    "INSERT INTO draft_teams (id, league_id, manager_id, name) "
                    "VALUES (:id, :league, :manager, :name)"
                ),
                [
                    {"id": team_a, "league": league, "manager": manager_a, "name": "Draw A"},
                    {"id": team_b, "league": league, "manager": manager_b, "name": "Draw B"},
                    {"id": team_c, "league": league, "manager": commissioner, "name": "Draw C"},
                ],
            )
            connection.execute(
                text(
                    "INSERT INTO league_memberships (id, league_id, manager_id, role) "
                    "VALUES (:id, :league, :manager, :role)"
                ),
                [
                    {
                        "id": f"dm-a-{suffix}",
                        "league": league,
                        "manager": manager_a,
                        "role": "manager",
                    },
                    {
                        "id": f"dm-b-{suffix}",
                        "league": league,
                        "manager": manager_b,
                        "role": "manager",
                    },
                    {
                        "id": f"dm-c-{suffix}",
                        "league": league,
                        "manager": commissioner,
                        "role": "commissioner",
                    },
                ],
            )
            connection.execute(
                text(
                    "INSERT INTO fpl_positions (id, singular_name, plural_name) "
                    "VALUES (:id, 'Defender', 'Defenders')"
                ),
                {"id": position_id},
            )
            connection.execute(
                text(
                    "INSERT INTO fpl_players "
                    "(id, first_name, second_name, web_name, position_id, team_id) "
                    "VALUES (:id, :name, 'Draw', :name, :position, :epl_team)"
                ),
                [
                    {
                        "id": player_a,
                        "name": "Draw One",
                        "position": position_id,
                        "epl_team": epl_team_id,
                    },
                    {
                        "id": player_b,
                        "name": "Draw Two",
                        "position": position_id,
                        "epl_team": epl_team_id,
                    },
                ],
            )
            connection.execute(
                text(
                    "INSERT INTO squad_roster_slots "
                    "(id, season_id, draft_team_id, slot_key, position_id, "
                    "sort_order, is_required) "
                    "VALUES (:id, :season, :team, 'DEF-1', :position, 1, false)"
                ),
                [
                    {"id": slot_a, "season": SEASON_ID, "team": team_a, "position": position_id},
                    {"id": slot_b, "season": SEASON_ID, "team": team_b, "position": position_id},
                ],
            )

        admin = _repository(session_factory, commissioner, commissioner, team_c)
        repo_a = _repository(session_factory, manager_a, manager_a, team_a)
        repo_b = _repository(session_factory, manager_b, manager_b, team_b)
        draw = admin.create_draw(
            FreeAgencyDrawCreateRequest(
                gameweek=int(gameweek), opens_at=now - timedelta(minutes=1), closes_at=close_at
            )
        )
        draw_id = draw.id
        admin.set_draw_status(
            draw.id,
            FreeAgencyDrawStatus.OPEN_FOR_PREFERENCES,
            "draw_opened",
            FreeAgencyDrawStatus.SCHEDULED,
        )
        repo_a.submit_preferences(
            draw.id, FreeAgencyPreferencesRequest(player_ids=[player_a, player_b])
        )
        repo_b.submit_preferences(draw.id, FreeAgencyPreferencesRequest(player_ids=[player_a]))
        with engine.begin() as connection:
            connection.execute(
                text("UPDATE free_agency_draws SET closes_at = :closed WHERE id = :id"),
                {"closed": now - timedelta(seconds=1), "id": draw.id},
            )

        processed = admin.process_draw(draw.id)
        repeated = admin.process_draw(draw.id)
        results_a = repo_a.results(draw.id)
        results_b = repo_b.results(draw.id)
        assert processed is not None and repeated is not None
        assert processed.status == repeated.status == FreeAgencyDrawStatus.PROCESSED
        assert processed.draw_order == repeated.draw_order
        assert results_a is not None and results_b is not None
        assert results_a.own_preferences[0].player_id == player_a
        assert results_b.own_preferences[0].player_id == player_a
        assert results_a.own_result is not None and results_b.own_result is not None
        assert results_a.own_result.won_player_id != results_b.own_result.won_player_id
        with session_factory() as session:
            result_count = session.execute(
                text("SELECT COUNT(*) FROM free_agency_results WHERE draw_id = :id"),
                {"id": draw.id},
            ).scalar_one()
            right_count = session.execute(
                text("SELECT COUNT(*) FROM player_rights WHERE source_ref = :id"), {"id": draw.id}
            ).scalar_one()
        assert result_count >= 3
        assert right_count == 2
    finally:
        if draw_id is not None:
            with engine.begin() as connection:
                connection.execute(
                    text("DELETE FROM free_agency_events WHERE draw_id = :id"), {"id": draw_id}
                )
                connection.execute(
                    text("DELETE FROM free_agency_results WHERE draw_id = :id"), {"id": draw_id}
                )
                connection.execute(
                    text("DELETE FROM free_agency_preferences WHERE draw_id = :id"), {"id": draw_id}
                )
                connection.execute(
                    text("DELETE FROM free_agency_draw_order WHERE draw_id = :id"), {"id": draw_id}
                )
                connection.execute(
                    text("DELETE FROM player_rights WHERE source_ref = :id"), {"id": draw_id}
                )
                connection.execute(
                    text("DELETE FROM free_agency_draws WHERE id = :id"), {"id": draw_id}
                )
                connection.execute(
                    text("DELETE FROM squad_ownerships WHERE player_id IN (:a, :b)"),
                    {"a": player_a, "b": player_b},
                )
                connection.execute(
                    text("DELETE FROM squad_roster_slots WHERE id IN (:a, :b)"),
                    {"a": slot_a, "b": slot_b},
                )
                connection.execute(
                    text("DELETE FROM fpl_players WHERE id IN (:a, :b)"),
                    {"a": player_a, "b": player_b},
                )
                connection.execute(
                    text("DELETE FROM fpl_positions WHERE id = :id"), {"id": position_id}
                )
                connection.execute(
                    text("DELETE FROM league_memberships WHERE id LIKE :prefix"),
                    {"prefix": f"dm-%-{suffix}"},
                )
                connection.execute(
                    text("DELETE FROM draft_teams WHERE id IN (:a, :b, :c)"),
                    {"a": team_a, "b": team_b, "c": team_c},
                )
                connection.execute(
                    text("DELETE FROM managers WHERE id IN (:a, :b, :c)"),
                    {"a": manager_a, "b": manager_b, "c": commissioner},
                )
                if seeded_gameweek_id is not None:
                    connection.execute(
                        text("DELETE FROM fpl_gameweeks WHERE id = :id"),
                        {"id": seeded_gameweek_id},
                    )
        elif seeded_gameweek_id is not None:
            with engine.begin() as connection:
                connection.execute(
                    text("DELETE FROM fpl_gameweeks WHERE id = :id"),
                    {"id": seeded_gameweek_id},
                )
        engine.dispose()
