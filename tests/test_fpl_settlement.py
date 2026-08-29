from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, insert, select, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.repositories.postgres_fpl_data import (
    external_payload_cache_table,
    fpl_gameweeks_table,
)
from cdl_api.repositories.postgres_league_fixtures import (
    cdl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
)
from cdl_api.repositories.postgres_team_selection import (
    team_selection_chips_table,
    team_selection_fixture_locks_table,
    team_selection_lineup_slots_table,
)
from cdl_api.services.fpl_settlement import FplSettlementService
from cdl_api.staging_draft_seed import LEAGUE_ID, SEASON_ID


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE fpl_gameweeks ("
                "id TEXT PRIMARY KEY, name TEXT NOT NULL, deadline_time DATETIME, "
                "is_previous BOOLEAN NOT NULL, is_current BOOLEAN NOT NULL, "
                "is_next BOOLEAN NOT NULL, finished BOOLEAN NOT NULL, "
                "data_checked BOOLEAN NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE external_payload_cache ("
                "resource TEXT PRIMARY KEY, endpoint TEXT NOT NULL, payload_json JSON NOT NULL, "
                "response_sha256 TEXT NOT NULL, fetched_at DATETIME NOT NULL)"
            )
        )
        for table_name in (
            "cdl_fixtures",
            "fixture_results",
            "fixture_scoring_snapshots",
        ):
            connection.execute(
                text(f"CREATE TABLE {table_name} (id TEXT PRIMARY KEY, payload_json JSON NOT NULL)")
            )
        connection.execute(
            text(
                "CREATE TABLE team_selection_lineup_slots ("
                "id TEXT PRIMARY KEY, season_id TEXT NOT NULL, draft_team_id TEXT NOT NULL, "
                "player_id TEXT NOT NULL, gameweek INTEGER NOT NULL, slot TEXT NOT NULL, "
                "slot_order INTEGER NOT NULL, is_captain BOOLEAN NOT NULL, "
                "is_vice_captain BOOLEAN NOT NULL, locked_at DATETIME, "
                "updated_at DATETIME NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE team_selection_chips ("
                "id TEXT PRIMARY KEY, season_id TEXT NOT NULL, draft_team_id TEXT NOT NULL, "
                "chip_id TEXT NOT NULL, status TEXT NOT NULL, active_gameweek INTEGER, "
                "used_gameweek INTEGER, updated_at DATETIME NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE team_selection_fixture_locks ("
                "id TEXT PRIMARY KEY, season_id TEXT NOT NULL, draft_team_id TEXT, "
                "gameweek INTEGER NOT NULL, fixture_id TEXT NOT NULL, fixture_type TEXT NOT NULL, "
                "lock_scope TEXT NOT NULL, locked_at DATETIME NOT NULL, reason TEXT NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE draft_teams ("
                "id TEXT PRIMARY KEY, league_id TEXT NOT NULL, name TEXT NOT NULL)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO draft_teams (id, league_id, name) VALUES "
                "('team-home', :league, 'Home'), ('team-away', :league, 'Away')"
            ),
            {"league": LEAGUE_ID},
        )
    return sessionmaker(bind=engine, class_=Session)


def test_settlement_locks_all_teams_marks_chips_used_and_freezes_results() -> None:
    sessions = _session_factory()
    now = datetime.now(UTC)
    with sessions() as session:
        session.execute(
            insert(fpl_gameweeks_table),
            [
                {
                    "id": "1",
                    "name": "Gameweek 1",
                    "deadline_time": now - timedelta(hours=1),
                    "is_previous": True,
                    "is_current": False,
                    "is_next": False,
                    "finished": True,
                    "data_checked": True,
                },
                {
                    "id": "2",
                    "name": "Gameweek 2",
                    "deadline_time": now - timedelta(minutes=30),
                    "is_previous": True,
                    "is_current": False,
                    "is_next": False,
                    "finished": False,
                    "data_checked": False,
                },
                {
                    "id": "3",
                    "name": "Gameweek 3",
                    "deadline_time": now + timedelta(days=6),
                    "is_previous": False,
                    "is_current": False,
                    "is_next": True,
                    "finished": False,
                    "data_checked": False,
                },
            ],
        )
        session.execute(
            insert(external_payload_cache_table).values(
                resource="event-live:1",
                endpoint="https://fantasy.premierleague.com/api/event/1/live/",
                payload_json={
                    "elements": [
                        {"id": player_id, "stats": {"total_points": 1}}
                        for player_id in range(1, 23)
                    ]
                },
                response_sha256="b" * 64,
                fetched_at=now,
            )
        )
        fixture_payload = {
            "id": "fixture-1",
            "gameweek": {"id": "gw-1", "name": "Gameweek 1", "number": 1},
            "home_team": {"id": "team-home", "name": "Home"},
            "away_team": {"id": "team-away", "name": "Away"},
            "status": "pending",
            "kickoff_label": "Gameweek 1",
            "round_label": "Regular season",
            "is_current": False,
            "is_next": False,
            "detail_available": False,
            "synthetic": True,
        }
        session.execute(
            insert(cdl_fixtures_table).values(id="fixture-1", payload_json=fixture_payload)
        )
        session.execute(
            insert(fixture_results_table).values(
                id="result-fixture-1",
                payload_json={
                    "fixture_id": "fixture-1",
                    "home_score": None,
                    "away_score": None,
                    "outcome": "pending",
                },
            )
        )
        session.execute(
            insert(fixture_scoring_snapshots_table).values(
                id="snapshot-fixture-1",
                payload_json={
                    "fixture_id": "fixture-1",
                    "epl_fixture_ids": ["epl-1"],
                    "synthetic": True,
                },
            )
        )
        lineup_rows = []
        for team_id, player_ids in (
            ("team-home", range(1, 12)),
            ("team-away", range(12, 23)),
        ):
            for slot_order, player_id in enumerate(player_ids, start=1):
                lineup_rows.append(
                    {
                        "id": f"lineup-{team_id}-1-{player_id}",
                        "season_id": SEASON_ID,
                        "draft_team_id": team_id,
                        "player_id": f"fpl-{player_id}",
                        "gameweek": 1,
                        "slot": "starter",
                        "slot_order": slot_order,
                        "is_captain": slot_order == 1,
                        "is_vice_captain": slot_order == 2,
                        "locked_at": None,
                        "updated_at": now,
                    }
                )
        session.execute(insert(team_selection_lineup_slots_table), lineup_rows)
        session.execute(
            insert(team_selection_chips_table).values(
                id="chip-team-home-triple-captain",
                season_id=SEASON_ID,
                draft_team_id="team-home",
                chip_id="triple-captain",
                status="active",
                active_gameweek=1,
                used_gameweek=None,
                updated_at=now,
            )
        )
        session.commit()

    result = FplSettlementService(sessions).settle()

    assert result.locked_gameweeks == 2
    assert result.locked_teams == 4
    assert result.settled_fixtures == 1
    assert result.skipped_fixtures == 0

    with sessions() as session:
        locks = list(session.execute(select(team_selection_fixture_locks_table)).mappings())
        assert {(row["gameweek"], row["draft_team_id"]) for row in locks} == {
            (1, "team-home"),
            (1, "team-away"),
            (2, "team-home"),
            (2, "team-away"),
        }
        chips = session.execute(select(team_selection_chips_table)).mappings().one()
        assert chips["status"] == "used"
        assert chips["used_gameweek"] == 1
        assert chips["active_gameweek"] == 1
        assert (
            session.execute(
                select(team_selection_lineup_slots_table.c.locked_at).where(
                    team_selection_lineup_slots_table.c.draft_team_id == "team-home",
                    team_selection_lineup_slots_table.c.gameweek == 1,
                )
            ).scalar()
            is not None
        )
        result_payload = session.execute(select(fixture_results_table.c.payload_json)).scalar_one()
        assert result_payload["finalised"] is True
        assert (result_payload["home_score"], result_payload["away_score"]) == (13, 12)
        snapshot_payload = session.execute(
            select(fixture_scoring_snapshots_table.c.payload_json)
        ).scalar_one()
        assert snapshot_payload["epl_fixture_ids"] == ["epl-1"]
        assert snapshot_payload["chips_played"] == {
            "team-home": ["Triple Captain"],
            "team-away": [],
        }
        next_rows = session.execute(
            select(team_selection_lineup_slots_table.c.id).where(
                team_selection_lineup_slots_table.c.gameweek == 3
            )
        ).all()
        assert len(next_rows) == 22

    second = FplSettlementService(sessions).settle()
    assert second.locked_teams == 0
    assert second.settled_fixtures == 0
