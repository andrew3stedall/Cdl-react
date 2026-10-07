from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, insert, select, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from cdl_api.repositories.postgres_fpl_data import (
    external_fetch_log_table,
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
        connection.execute(
            text(
                "CREATE TABLE external_fetch_log (id TEXT PRIMARY KEY, resource TEXT NOT NULL, "
                "endpoint TEXT NOT NULL, status_code INTEGER, response_sha256 TEXT, "
                "record_count INTEGER NOT NULL, error TEXT, fetched_at DATETIME NOT NULL)"
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
                "CREATE TABLE squad_roster_slots (id TEXT PRIMARY KEY, season_id TEXT NOT NULL, "
                "draft_team_id TEXT NOT NULL, sort_order INTEGER NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE squad_ownerships (id TEXT PRIMARY KEY, season_id TEXT NOT NULL, "
                "draft_team_id TEXT NOT NULL, player_id TEXT NOT NULL, roster_slot_id TEXT, "
                "started_at DATETIME NOT NULL, ended_at DATETIME)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE team_selection_lineup_slots ("
                "id TEXT PRIMARY KEY, season_id TEXT NOT NULL, draft_team_id TEXT NOT NULL, "
                "player_id TEXT NOT NULL, gameweek INTEGER NOT NULL, slot TEXT NOT NULL, "
                "slot_order INTEGER NOT NULL, is_captain BOOLEAN NOT NULL, "
                "is_vice_captain BOOLEAN NOT NULL, locked_at DATETIME, "
                "rule_version_id TEXT, "
                "updated_at DATETIME NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE league_season_rule_state (season_id TEXT PRIMARY KEY, "
                "active_version_id TEXT NOT NULL, updated_at DATETIME NOT NULL)"
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
            text(
                "INSERT INTO league_season_rule_state "
                "(season_id, active_version_id, updated_at) VALUES "
                "(:season, :version, :updated)"
            ),
            {"season": SEASON_ID, "version": "rules-season-cdl-2026-27-v1", "updated": now},
        )
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
        assert snapshot_payload["automatic_substitution_version"] == 1
        assert snapshot_payload["rules_version_id"] == "rules-season-cdl-2026-27-v1"
        assert result_payloads["fixture-1"]["rules_version_id"] == "rules-season-cdl-2026-27-v1"
        assert {
            row[0]
            for row in session.execute(
                select(team_selection_lineup_slots_table.c.rule_version_id).where(
                    team_selection_lineup_slots_table.c.gameweek == 1
                )
            ).all()
        } == {"rules-season-cdl-2026-27-v1"}
        assert snapshot_payload["chips_played"] == {
            "team-home": ["Triple Captain"],
            "team-away": [],
        }
        assert result.skipped_fixtures == 0
        next_rows = session.execute(
            select(team_selection_lineup_slots_table.c.id).where(
                team_selection_lineup_slots_table.c.gameweek == 3
            )
        ).all()
        assert len(next_rows) == 22

    second = FplSettlementService(sessions).settle()
    assert second.locked_teams == 0
    assert second.settled_fixtures == 0

    with sessions() as session:
        session.execute(
            text(
                "UPDATE league_season_rule_state SET active_version_id = :version "
                "WHERE season_id = :season"
            ),
            {"season": SEASON_ID, "version": "rules-season-cdl-2026-27-v2"},
        )
        session.commit()
    third = FplSettlementService(sessions).settle()
    assert third.settled_fixtures == 0


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
        session.execute(
            lineup_substitutions_table.delete().where(
                lineup_substitutions_table.c.fixture_id == "fixture-automatic-substitution",
                lineup_substitutions_table.c.starter_player_id == "fpl-10",
            )
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


def test_auto_captain_applies_only_one_bonus_and_explains_player_totals() -> None:
    sessions = _session_factory()
    now = datetime.now(UTC)
    rows = []
    for team_id, player_ids in (
        ("team-home", range(1, 12)),
        ("team-away", range(12, 23)),
    ):
        rows.extend(
            {
                "id": f"lineup-{team_id}-{player_id}",
                "season_id": SEASON_ID,
                "draft_team_id": team_id,
                "player_id": f"fpl-{player_id}",
                "gameweek": 1,
                "slot": "starter",
                "slot_order": order,
                "is_captain": order == 1,
                "is_vice_captain": order == 2,
                "locked_at": now,
                "updated_at": now,
            }
            for order, player_id in enumerate(player_ids, start=1)
        )
    with sessions() as session:
        session.execute(insert(team_selection_lineup_slots_table), rows)
        session.execute(
            insert(team_selection_chips_table).values(
                id="chip-team-home-auto",
                season_id=SEASON_ID,
                draft_team_id="team-home",
                chip_id="auto-captain",
                status="used",
                active_gameweek=1,
                used_gameweek=1,
                updated_at=now,
            )
        )
        session.commit()
    points = {str(player_id): 1 for player_id in range(1, 23)}
    points.update({"1": 5, "2": 10})
    with sessions() as session:
        scores = FplSettlementService._team_scores(
            session,
            1,
            ("team-home", "team-away"),
            points,
            {str(player_id): 90 for player_id in range(1, 23)},
            apply_substitutions=False,
        )
    assert scores is not None
    assert scores[0] == 34
    explanation = {row["player_id"]: row for row in scores[5]["team-home"]}
    assert explanation["fpl-1"]["multiplier"] == 1
    assert explanation["fpl-2"]["multiplier"] == 2


def test_auto_captain_tie_uses_starting_slot_and_ignores_bench() -> None:
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
                "is_captain": slot_order == 1,
                "is_vice_captain": slot_order == 2,
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
            for slot_order, player_id in enumerate(bench, start=1)
        )

    with sessions() as session:
        session.execute(insert(team_selection_lineup_slots_table), lineup_rows)
        session.execute(
            insert(team_selection_chips_table).values(
                id="chip-team-home-auto-tie",
                season_id=SEASON_ID,
                draft_team_id="team-home",
                chip_id="auto-captain",
                status="used",
                active_gameweek=1,
                used_gameweek=1,
                updated_at=now,
            )
        )
        session.commit()

    points = {str(player_id): 1 for player_id in range(1, 33)}
    points.update({"1": 5, "2": 5, "23": 20})

    with sessions() as session:
        scores = FplSettlementService._team_scores(
            session,
            1,
            ("team-home", "team-away"),
            points,
            {str(player_id): 90 for player_id in range(1, 33)},
            apply_substitutions=False,
        )

    assert scores is not None
    assert scores[0] == 24
    explanation = {row["player_id"]: row for row in scores[5]["team-home"]}
    assert explanation["fpl-1"]["multiplier"] == 2
    assert explanation["fpl-2"]["multiplier"] == 1
    assert explanation["fpl-23"]["included"] is False
    assert explanation["fpl-23"]["reason"] == "bench_not_scoring"


def test_ownership_repair_replaces_departed_player_only_in_future_unlocked_lineup() -> None:
    from cdl_api.repositories.postgres_squad import (
        squad_ownerships_table,
        squad_roster_slots_table,
    )
    from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository

    sessions = _session_factory()
    now = datetime.now(UTC)
    with sessions() as session:
        session.execute(
            insert(fpl_gameweeks_table).values(
                id="2",
                name="Gameweek 2",
                deadline_time=now + timedelta(days=1),
                is_previous=False,
                is_current=False,
                is_next=True,
                finished=False,
                data_checked=False,
            )
        )
        session.execute(
            insert(squad_roster_slots_table),
            [
                {
                    "id": f"slot-{player_id}",
                    "season_id": SEASON_ID,
                    "draft_team_id": "team-home",
                    "sort_order": order,
                }
                for order, player_id in enumerate(("fpl-1", "fpl-3", "fpl-24"), start=1)
            ],
        )
        session.execute(
            insert(squad_ownerships_table),
            [
                {
                    "id": f"ownership-{player_id}",
                    "season_id": SEASON_ID,
                    "draft_team_id": "team-home",
                    "player_id": player_id,
                    "roster_slot_id": None if player_id == "fpl-24" else f"slot-{player_id}",
                    "started_at": now,
                    "ended_at": None,
                }
                for player_id in ("fpl-1", "fpl-3", "fpl-24")
            ],
        )
        rows = []
        for gameweek, locked_at in ((1, now), (2, None)):
            for slot_order, player_id in enumerate(("fpl-1", "fpl-2", "fpl-3"), start=1):
                rows.append(
                    {
                        "id": f"lineup-team-home-{gameweek}-{player_id}",
                        "season_id": SEASON_ID,
                        "draft_team_id": "team-home",
                        "player_id": player_id,
                        "gameweek": gameweek,
                        "slot": "starter",
                        "slot_order": slot_order,
                        "is_captain": slot_order == 1,
                        "is_vice_captain": slot_order == 2,
                        "locked_at": locked_at,
                        "updated_at": now,
                    }
                )
        for slot_order, player_id in enumerate(("fpl-1", "fpl-2", "fpl-3"), start=1):
            rows.append(
                {
                    "id": f"lineup-team-home-3-{player_id}",
                    "season_id": SEASON_ID,
                    "draft_team_id": "team-home",
                    "player_id": player_id,
                    "gameweek": 3,
                    "slot": "starter",
                    "slot_order": slot_order,
                    "is_captain": slot_order == 1,
                    "is_vice_captain": slot_order == 2,
                    "locked_at": now if slot_order == 1 else None,
                    "updated_at": now,
                }
            )
        session.execute(insert(team_selection_lineup_slots_table), rows)
        PostgreSQLTeamSelectionRepository.repair_unlocked_lineups(
            session, "team-home", {"fpl-1", "fpl-3", "fpl-24"}, now
        )
        session.commit()
        updated = list(
            session.execute(
                select(
                    team_selection_lineup_slots_table.c.gameweek,
                    team_selection_lineup_slots_table.c.player_id,
                    team_selection_lineup_slots_table.c.is_captain,
                    team_selection_lineup_slots_table.c.is_vice_captain,
                ).order_by(
                    team_selection_lineup_slots_table.c.gameweek,
                    team_selection_lineup_slots_table.c.slot_order,
                )
            ).all()
        )

    assert updated[:3] == [
        (1, "fpl-1", True, False),
        (1, "fpl-2", False, True),
        (1, "fpl-3", False, False),
    ]
    future_flags = {
        player_id: (is_captain, is_vice_captain)
        for gameweek, player_id, is_captain, is_vice_captain in updated
        if gameweek == 2
    }
    assert future_flags == {
        "fpl-1": (True, False),
        "fpl-3": (False, False),
        "fpl-24": (False, True),
    }
    assert {player_id for gameweek, player_id, _, _ in updated if gameweek == 3} == {
        "fpl-1",
        "fpl-2",
        "fpl-3",
    }


def test_settlement_repairs_a_finalised_fixture_missing_substitution_pass() -> None:
    sessions = _session_factory()
    now = datetime.now(UTC)
    lineup_rows = []
    for team_id, starters, bench in (
        ("team-home", range(1, 12), range(23, 28)),
        ("team-away", range(12, 23), range(28, 33)),
    ):
        lineup_rows.extend(
            {
                "id": f"lineup-{team_id}-repair-{player_id}",
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
                "id": f"lineup-{team_id}-repair-{player_id}",
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
        session.execute(
            text(
                "INSERT INTO league_season_rule_state "
                "(season_id, active_version_id, updated_at) VALUES "
                "(:season, :version, :updated)"
            ),
            {"season": SEASON_ID, "version": "rules-season-cdl-2026-27-v2", "updated": now},
        )
        session.execute(
            insert(fpl_gameweeks_table).values(
                id="1",
                name="Gameweek 1",
                deadline_time=now - timedelta(hours=1),
                is_previous=True,
                is_current=False,
                is_next=False,
                finished=True,
                data_checked=True,
            )
        )
        session.execute(
            insert(external_payload_cache_table).values(
                resource="event-live:1",
                endpoint="https://fantasy.premierleague.com/api/event/1/live/",
                payload_json={
                    "elements": [
                        {
                            "id": player_id,
                            "stats": {
                                "total_points": 2 if player_id in (24, 25) else 1,
                                "minutes": 0 if player_id in (2, 10, 23) else 90,
                            },
                        }
                        for player_id in range(1, 33)
                    ]
                },
                response_sha256="r" * 64,
                fetched_at=now,
            )
        )
        fixture_payload = {
            "id": "fixture-repair",
            "gameweek": {"id": "gw-1", "name": "Gameweek 1", "number": 1},
            "home_team": {"id": "team-home", "name": "Home"},
            "away_team": {"id": "team-away", "name": "Away"},
            "status": "pending",
            "synthetic": False,
        }
        session.execute(
            insert(cdl_fixtures_table).values(id="fixture-repair", payload_json=fixture_payload)
        )
        session.execute(
            insert(fixture_results_table).values(
                id="result-fixture-repair",
                payload_json={
                    "fixture_id": "fixture-repair",
                    "home_score": 11,
                    "away_score": 11,
                    "outcome": "draw",
                    "finalised": True,
                    "finalised_at": "2026-09-01T00:00:00+00:00",
                    "source_response_sha256": "r" * 64,
                    "synthetic": False,
                    "rules_version_id": "rules-season-cdl-2026-27-v1",
                },
            )
        )
        session.execute(
            insert(fixture_scoring_snapshots_table).values(
                id="snapshot-fixture-repair",
                payload_json={
                    "fixture_id": "fixture-repair",
                    "substitutions": {"team-home": [], "team-away": []},
                    "synthetic": False,
                    "rules_version_id": "rules-season-cdl-2026-27-v1",
                },
            )
        )
        session.execute(insert(team_selection_lineup_slots_table), lineup_rows)
        session.commit()

    result = FplSettlementService(sessions).settle()

    assert result.settled_fixtures == 1
    with sessions() as session:
        result_payload = session.execute(
            select(fixture_results_table.c.payload_json).where(
                fixture_results_table.c.id == "result-fixture-repair"
            )
        ).scalar_one()
        snapshot_payload = session.execute(
            select(fixture_scoring_snapshots_table.c.payload_json).where(
                fixture_scoring_snapshots_table.c.id == "snapshot-fixture-repair"
            )
        ).scalar_one()
        substitution_rows = (
            session.execute(
                select(lineup_substitutions_table.c.starter_player_id).where(
                    lineup_substitutions_table.c.fixture_id == "fixture-repair"
                )
            )
            .scalars()
            .all()
        )
        lineup_rule_versions = (
            session.execute(
                select(team_selection_lineup_slots_table.c.rule_version_id).where(
                    team_selection_lineup_slots_table.c.gameweek == 1
                )
            )
            .scalars()
            .all()
        )

    assert (result_payload["home_score"], result_payload["away_score"]) == (13, 11)
    assert result_payload["finalised_at"] == "2026-09-01T00:00:00+00:00"
    assert result_payload["rules_version_id"] == "rules-season-cdl-2026-27-v1"
    assert snapshot_payload["automatic_substitution_version"] == 1
    assert snapshot_payload["rules_version_id"] == "rules-season-cdl-2026-27-v1"
    assert set(lineup_rule_versions) == {None}
    assert snapshot_payload["substitutions"]["team-home"] == [
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
    assert substitution_rows == ["fpl-2", "fpl-10"]


def test_completed_fixture_stays_provisional_after_failed_final_event_refresh() -> None:
    sessions = _session_factory()
    now = datetime.now(UTC)
    old_fetched_at = now - timedelta(hours=1)

    with sessions() as session:
        session.execute(
            insert(fpl_gameweeks_table).values(
                id="1",
                name="Gameweek 1",
                deadline_time=now - timedelta(hours=2),
                is_previous=True,
                is_current=False,
                is_next=False,
                finished=True,
                data_checked=True,
            )
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
                response_sha256="old" * 16,
                fetched_at=old_fetched_at,
            )
        )
        session.execute(
            insert(external_fetch_log_table).values(
                id="failed-final-event-live-1",
                resource="event-live-final:1",
                endpoint="https://fantasy.premierleague.com/api/event/1/live/",
                status_code=None,
                response_sha256=None,
                record_count=0,
                error="upstream final event refresh failed",
                fetched_at=now,
            )
        )
        fixture_payload = {
            "id": "fixture-unverified-final",
            "gameweek": {"id": "gw-1", "name": "Gameweek 1", "number": 1},
            "home_team": {"id": "team-home", "name": "Home"},
            "away_team": {"id": "team-away", "name": "Away"},
            "status": "pending",
            "synthetic": False,
        }
        session.execute(
            insert(cdl_fixtures_table).values(
                id="fixture-unverified-final",
                payload_json=fixture_payload,
            )
        )
        session.execute(
            insert(fixture_results_table).values(
                id="result-fixture-unverified-final",
                payload_json={
                    "fixture_id": "fixture-unverified-final",
                    "home_score": 11,
                    "away_score": 10,
                    "outcome": "home_win",
                    "finalised": False,
                },
            )
        )
        session.execute(
            insert(team_selection_lineup_slots_table),
            [
                {
                    "id": f"lineup-unverified-{team_id}-{player_id}",
                    "season_id": SEASON_ID,
                    "draft_team_id": team_id,
                    "player_id": f"fpl-{player_id}",
                    "gameweek": 1,
                    "slot": "starter",
                    "slot_order": slot_order,
                    "is_captain": False,
                    "is_vice_captain": False,
                    "locked_at": None,
                    "updated_at": now,
                }
                for team_id, player_ids in (
                    ("team-home", range(1, 12)),
                    ("team-away", range(12, 23)),
                )
                for slot_order, player_id in enumerate(player_ids, start=1)
            ],
        )
        session.commit()

    with sessions() as session:
        settled, skipped = FplSettlementService._settle_completed_fixtures(
            session, now, {1: now - timedelta(hours=1)}
        )
        session.commit()

    assert settled == 0
    assert skipped == 1
    with sessions() as session:
        payload = session.execute(
            select(fixture_results_table.c.payload_json).where(
                fixture_results_table.c.id == "result-fixture-unverified-final"
            )
        ).scalar_one()
    assert payload["finalised"] is False
    assert payload["settlement_skipped_reason"] == "final_event_live_unverified"



def test_finalised_current_season_fixture_backfills_frozen_league_bonus() -> None:
    sessions = _session_factory()
    now = datetime.now(UTC)

    with sessions() as session:
        session.execute(
            text(
                "INSERT INTO league_season_rule_state "
                "(season_id, active_version_id, updated_at) VALUES "
                "(:season, :version, :updated)"
            ),
            {
                "season": SEASON_ID,
                "version": "rules-season-cdl-2026-27-v1",
                "updated": now,
            },
        )
        session.execute(
            insert(fpl_gameweeks_table).values(
                id="1",
                name="Gameweek 1",
                deadline_time=now - timedelta(hours=2),
                is_previous=True,
                is_current=False,
                is_next=False,
                finished=True,
                data_checked=True,
            )
        )
        session.execute(
            insert(cdl_fixtures_table).values(
                id="fixture-bonus-backfill",
                payload_json={
                    "id": "fixture-bonus-backfill",
                    "gameweek": {"id": "gw-1", "name": "Gameweek 1", "number": 1},
                    "home_team": {"id": "team-home", "name": "Home"},
                    "away_team": {"id": "team-away", "name": "Away"},
                    "status": "complete",
                    "round_label": "Regular season",
                    "synthetic": False,
                },
            )
        )
        session.execute(
            insert(fixture_results_table).values(
                id="result-fixture-bonus-backfill",
                payload_json={
                    "fixture_id": "fixture-bonus-backfill",
                    "home_score": 120,
                    "away_score": 60,
                    "outcome": "home_win",
                    "finalised": True,
                    "finalised_at": now.isoformat(),
                    "synthetic": False,
                    "rules_version_id": "rules-season-cdl-2026-27-v1",
                },
            )
        )
        session.execute(
            insert(fixture_scoring_snapshots_table).values(
                id="snapshot-fixture-bonus-backfill",
                payload_json={
                    "fixture_id": "fixture-bonus-backfill",
                    "home_score": 120,
                    "away_score": 60,
                    "automatic_substitution_version": 1,
                    "synthetic": False,
                    "rules_version_id": "rules-season-cdl-2026-27-v1",
                },
            )
        )
        session.commit()

    with sessions() as session:
        settled, skipped = FplSettlementService._settle_completed_fixtures(
            session,
            now,
            {1: now - timedelta(hours=1)},
        )
        session.commit()

    assert settled == 1
    assert skipped == 0
    with sessions() as session:
        result_payload = session.execute(
            select(fixture_results_table.c.payload_json).where(
                fixture_results_table.c.id == "result-fixture-bonus-backfill"
            )
        ).scalar_one()
        snapshot_payload = session.execute(
            select(fixture_scoring_snapshots_table.c.payload_json).where(
                fixture_scoring_snapshots_table.c.id == "snapshot-fixture-bonus-backfill"
            )
        ).scalar_one()

    assert result_payload["bonus_points"] == {"team-home": 1, "team-away": 0}
    assert snapshot_payload["bonus_points"] == {"team-home": 1, "team-away": 0}
    assert snapshot_payload["bonus_basis"] == {"home_score": 120, "away_score": 60}
    assert snapshot_payload["rules_version_id"] == "rules-season-cdl-2026-27-v1"
    assert snapshot_payload["bonus_rules_version_id"] == "rules-season-cdl-2026-27-v1"
