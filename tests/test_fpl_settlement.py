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
    lineup_substitutions_table,
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
            text("CREATE TABLE fpl_players (id TEXT PRIMARY KEY, position_id TEXT NOT NULL)")
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
                "CREATE TABLE lineup_substitutions ("
                "id TEXT PRIMARY KEY, season_id TEXT NOT NULL, draft_team_id TEXT NOT NULL, "
                "gameweek INTEGER NOT NULL, fixture_id TEXT NOT NULL, snapshot_id TEXT NOT NULL, "
                "starter_player_id TEXT NOT NULL, substitute_player_id TEXT NOT NULL, "
                "starter_slot_order INTEGER NOT NULL, bench_order INTEGER NOT NULL, "
                "reason TEXT NOT NULL, formation_preserved BOOLEAN NOT NULL, "
                "created_at DATETIME NOT NULL)"
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
        connection.execute(
            text("INSERT INTO fpl_players (id, position_id) VALUES (:id, :position)"),
            [
                {
                    "id": f"fpl-{player_id}",
                    "position": (
                        "GKP"
                        if player_id in (1, 12)
                        else "DEF"
                        if player_id in (*range(2, 6), *range(13, 17))
                        else "MID"
                        if player_id in (*range(6, 10), *range(17, 21))
                        else {
                            23: "GKP",
                            24: "DEF",
                            25: "MID",
                            26: "FWD",
                            27: "DEF",
                            28: "GKP",
                            29: "DEF",
                            30: "MID",
                            31: "FWD",
                            32: "DEF",
                        }.get(player_id, "FWD")
                    ),
                }
                for player_id in range(1, 33)
            ],
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
            insert(external_payload_cache_table),
            [
                {
                    "resource": f"event-live:{gameweek}",
                    "endpoint": f"https://fantasy.premierleague.com/api/event/{gameweek}/live/",
                    "payload_json": {
                        "elements": [
                            {"id": player_id, "stats": {"total_points": 1}}
                            for player_id in range(1, 23)
                        ]
                    },
                    "response_sha256": chr(96 + gameweek) * 64,
                    "fetched_at": now,
                }
                for gameweek in (1, 2)
            ],
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
        fixture_two_payload = {
            **fixture_payload,
            "id": "fixture-2",
            "gameweek": {"id": "gw-2", "name": "Gameweek 2", "number": 2},
        }
        session.execute(
            insert(cdl_fixtures_table).values(id="fixture-2", payload_json=fixture_two_payload)
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
        result_payloads = {
            row["fixture_id"]: row
            for row in session.execute(select(fixture_results_table.c.payload_json)).scalars()
        }
        assert result_payloads["fixture-1"]["finalised"] is True
        assert (
            result_payloads["fixture-1"]["home_score"],
            result_payloads["fixture-1"]["away_score"],
        ) == (13, 12)
        assert result_payloads["fixture-2"]["finalised"] is False
        assert (
            result_payloads["fixture-2"]["home_score"],
            result_payloads["fixture-2"]["away_score"],
        ) == (12, 12)
        snapshot_payload = session.execute(
            select(fixture_scoring_snapshots_table.c.payload_json).where(
                fixture_scoring_snapshots_table.c.id == "snapshot-fixture-1"
            )
        ).scalar_one()
        assert snapshot_payload["epl_fixture_ids"] == ["epl-1"]
        assert snapshot_payload["substitutions"] == {"team-home": [], "team-away": []}
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


def test_final_team_scores_apply_automatic_substitutions() -> None:
    sessions = _session_factory()
    now = datetime.now(UTC)
    lineup_rows = []
    for team_id, starters, bench in (
        ("team-home", range(1, 12), range(23, 28)),
        ("team-away", range(12, 23), range(28, 33)),
    ):
        lineup_rows.extend(
            {
                "id": f"lineup-{team_id}-{player_id}",
                "season_id": SEASON_ID,
                "draft_team_id": team_id,
                "player_id": f"fpl-{player_id}",
                "gameweek": 1,
                "slot": "starter",
                "slot_order": slot_order,
                "is_captain": False,
                "is_vice_captain": False,
                "locked_at": now,
                "updated_at": now,
            }
            for slot_order, player_id in enumerate(starters, start=1)
        )
        lineup_rows.extend(
            {
                "id": f"lineup-{team_id}-{player_id}",
                "season_id": SEASON_ID,
                "draft_team_id": team_id,
                "player_id": f"fpl-{player_id}",
                "gameweek": 1,
                "slot": "bench",
                "slot_order": slot_order,
                "is_captain": False,
                "is_vice_captain": False,
                "locked_at": now,
                "updated_at": now,
            }
            for slot_order, player_id in enumerate(bench)
        )
    with sessions() as session:
        session.execute(insert(team_selection_lineup_slots_table), lineup_rows)
        session.commit()

    player_points = {
        str(player_id): (2 if player_id in (24, 25) else 1) for player_id in range(1, 33)
    }
    player_minutes = {str(player_id): 90 for player_id in range(1, 33)}
    player_minutes.update({"2": 0, "10": 0, "23": 0})

    with sessions() as session:
        scores = FplSettlementService._team_scores(
            session,
            1,
            ("team-home", "team-away"),
            player_points,
            player_minutes,
            apply_substitutions=True,
        )

    assert scores is not None
    assert scores[0:2] == (13, 11)
    assert scores[4]["team-home"] == [
        {
            "starter_player_id": "fpl-2",
            "substitute_player_id": "fpl-24",
            "starter_slot_order": 2,
            "bench_order": 1,
            "reason": "starter_did_not_play",
            "formation_preserved": True,
        },
        {
            "starter_player_id": "fpl-10",
            "substitute_player_id": "fpl-25",
            "starter_slot_order": 10,
            "bench_order": 2,
            "reason": "starter_did_not_play",
            "formation_preserved": True,
        },
    ]

    with sessions() as session:
        FplSettlementService._persist_substitutions(
            session,
            fixture_id="fixture-automatic-substitution",
            gameweek=1,
            substitutions=scores[4],
            created_at=now,
        )
        session.commit()
        FplSettlementService._persist_substitutions(
            session,
            fixture_id="fixture-automatic-substitution",
            gameweek=1,
            substitutions=scores[4],
            created_at=now,
        )
        substitution_ids = (
            session.execute(
                select(lineup_substitutions_table.c.id).where(
                    lineup_substitutions_table.c.fixture_id == "fixture-automatic-substitution"
                )
            )
            .scalars()
            .all()
        )
        assert len(substitution_ids) == 2
        assert all(len(substitution_id) == 61 for substitution_id in substitution_ids)
