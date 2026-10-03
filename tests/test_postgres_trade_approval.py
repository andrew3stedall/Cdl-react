import os
from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.contracts.domain import TeamSummary
from cdl_api.contracts.squad import TradeApprovalDecision, TradeApprovalStatus
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository
from cdl_api.services.squad import SquadManagementService
from cdl_api.services.team_selection import TeamSelectionService
from cdl_api.staging_draft_seed import LEAGUE_ID, SEASON_ID


@pytest.fixture
def trade_database(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[Engine, sessionmaker[Session]]]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    session_factory = sessionmaker(engine)
    statements = (
        """CREATE TABLE managers (
            id TEXT PRIMARY KEY, user_id TEXT, display_name TEXT
        )""",
        """CREATE TABLE draft_teams (
            id TEXT PRIMARY KEY, league_id TEXT, manager_id TEXT, name TEXT
        )""",
        """CREATE TABLE league_memberships (
            id TEXT PRIMARY KEY, league_id TEXT, manager_id TEXT, role TEXT
        )""",
        """CREATE TABLE trade_proposals (
            id TEXT PRIMARY KEY, season_id TEXT, offered_by_team_id TEXT,
            offered_to_team_id TEXT, gameweek INTEGER, status TEXT,
            approval_status TEXT, required_approver_role TEXT,
            approved_by_manager_id TEXT, executed_at TIMESTAMP,
            created_at TIMESTAMP, updated_at TIMESTAMP
        )""",
        """CREATE TABLE trade_assets (
            id TEXT PRIMARY KEY, trade_id TEXT, player_id TEXT,
            from_team_id TEXT, to_team_id TEXT
        )""",
        """CREATE TABLE squad_ownerships (
            id TEXT PRIMARY KEY, season_id TEXT, draft_team_id TEXT,
            player_id TEXT, roster_slot_id TEXT, started_at TIMESTAMP,
            ended_at TIMESTAMP
        )""",
        """CREATE TABLE squad_roster_slots (
            id TEXT PRIMARY KEY, season_id TEXT, draft_team_id TEXT,
            slot_key TEXT, position_id TEXT, sort_order INTEGER
        )""",
        "CREATE TABLE fpl_positions (id TEXT PRIMARY KEY, singular_name TEXT)",
        "CREATE TABLE fpl_players (id TEXT PRIMARY KEY, position_id TEXT)",
        """CREATE TABLE trade_approvals (
            id TEXT PRIMARY KEY, trade_id TEXT, manager_id TEXT,
            decision TEXT, note TEXT, decided_at TIMESTAMP
        )""",
        """CREATE TABLE squad_audit_events (
            id TEXT PRIMARY KEY, subject_type TEXT, subject_id TEXT,
            action TEXT, actor_manager_id TEXT, created_at TIMESTAMP,
            metadata_json JSON
        )""",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(
            text(
                "INSERT INTO managers VALUES "
                "('manager-a', 'user-a', 'A'), ('manager-b', 'user-b', 'B'), "
                "('manager-c', 'user-c', 'C'), ('manager-v', 'user-v', 'V')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO draft_teams VALUES "
                "('team-a', 'league-x', 'manager-a', 'A'), "
                "('team-b', 'league-x', 'manager-b', 'B'), "
                "('team-c', 'league-y', 'manager-c', 'C')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO league_memberships VALUES "
                "('member-a', 'league-x', 'manager-a', 'manager'), "
                "('member-b', 'league-x', 'manager-b', 'manager'), "
                "('member-c', 'league-x', 'manager-c', 'commissioner'), "
                "('member-v', 'league-x', 'manager-v', 'vice_commissioner')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO fpl_positions VALUES "
                "('DEF', 'Defender'), ('MID', 'Midfielder'), "
                "('GK', 'Goalkeeper'), ('FWD', 'Forward')"
            )
        )
    monkeypatch.setattr(
        PostgreSQLTeamSelectionRepository,
        "repair_unlocked_lineups",
        staticmethod(lambda _session, _team_id, _owned_ids, _now: None),
        raising=False,
    )
    yield engine, session_factory
    engine.dispose()


def _seed_trade(
    session_factory: sessionmaker[Session], asset_count: int = 1, team_b_size: int = 1
) -> None:
    now = datetime.now(UTC)
    with session_factory.begin() as session:
        session.execute(
            text(
                "INSERT INTO trade_proposals VALUES "
                "('trade-1', 'season-x', 'team-a', 'team-b', 4, 'accepted', "
                "'pending', 'commissioner', NULL, NULL, :now, :now)"
            ),
            {"now": now},
        )
        team_a_slot_positions = ["MID"] * asset_count + ["DEF"]
        for index, position in enumerate(team_a_slot_positions):
            session.execute(
                text(
                    "INSERT INTO squad_roster_slots VALUES "
                    "(:id, 'season-x', 'team-a', :key, :position, :order)"
                ),
                {
                    "id": f"slot-a-{index}",
                    "key": f"A-{index}",
                    "position": position,
                    "order": index,
                },
            )
        team_b_slot_positions = ["DEF"] * 10 + ["MID"] * 6 + ["GK"] * 3 + ["FWD"]
        team_b_slot_positions += ["MID"] * max(
            0, team_b_size + asset_count - len(team_b_slot_positions)
        )
        for index, position in enumerate(team_b_slot_positions):
            session.execute(
                text(
                    "INSERT INTO squad_roster_slots VALUES "
                    "(:id, 'season-x', 'team-b', :key, :position, :order)"
                ),
                {
                    "id": f"slot-b-{index}",
                    "key": f"B-{index}",
                    "position": position,
                    "order": index,
                },
            )
        team_a_player_ids = [f"a-{index}" for index in range(asset_count)]
        team_b_player_ids = [f"b-{index}" for index in range(team_b_size)]
        for player_id in team_a_player_ids:
            session.execute(text("INSERT INTO fpl_players VALUES (:id, 'MID')"), {"id": player_id})
        team_b_player_positions = ["DEF"] * min(10, team_b_size)
        team_b_player_positions += ["MID"] * min(6, max(0, team_b_size - 10))
        team_b_player_positions += ["GK"] * min(3, max(0, team_b_size - 16))
        team_b_player_positions += ["FWD"] * min(1, max(0, team_b_size - 19))
        for player_id, position in zip(team_b_player_ids, team_b_player_positions, strict=True):
            session.execute(
                text("INSERT INTO fpl_players VALUES (:id, :position)"),
                {"id": player_id, "position": position},
            )
        for index, player_id in enumerate(team_a_player_ids):
            session.execute(
                text(
                    "INSERT INTO squad_ownerships VALUES "
                    "(:id, 'season-x', 'team-a', :player, :slot, :now, NULL)"
                ),
                {
                    "id": f"own-a-{index}",
                    "player": player_id,
                    "slot": f"slot-a-{index}",
                    "now": now,
                },
            )
        for index, player_id in enumerate(team_b_player_ids):
            session.execute(
                text(
                    "INSERT INTO squad_ownerships VALUES "
                    "(:id, 'season-x', 'team-b', :player, :slot, :now, NULL)"
                ),
                {
                    "id": f"own-b-{index}",
                    "player": player_id,
                    "slot": f"slot-b-{index}",
                    "now": now,
                },
            )
        assets = [(player_id, "team-a", "team-b") for player_id in team_a_player_ids]
        if team_b_player_ids:
            assets.append(("b-0", "team-b", "team-a"))
        for index, (player_id, source, target) in enumerate(assets):
            session.execute(
                text("INSERT INTO trade_assets VALUES (:id, 'trade-1', :player, :source, :target)"),
                {"id": f"asset-{index}", "player": player_id, "source": source, "target": target},
            )


def _repository(session_factory: sessionmaker[Session]) -> PostgreSQLSquadRepository:
    repository = PostgreSQLSquadRepository.__new__(PostgreSQLSquadRepository)
    repository._session_factory = session_factory
    repository._players_cache = None
    repository._get_trade = lambda _trade_id: None
    return repository


def test_team_lookup_does_not_disclose_a_foreign_league_team(
    trade_database: tuple[Engine, sessionmaker[Session]],
) -> None:
    _, session_factory = trade_database
    repository = _repository(session_factory)
    repository.manager_team = TeamSummary(id="team-a", name="A")
    repository.rival_team = TeamSummary(id="team-b", name="B")

    assert repository.team_for_id("team-b") == TeamSummary(id="team-b", name="B")
    assert repository.team_for_id("team-c") is None


def test_postgres_trade_approval_moves_squad_history_and_assigns_compatible_slots(
    trade_database: tuple[Engine, sessionmaker[Session]],
) -> None:
    engine, session_factory = trade_database
    _seed_trade(session_factory)
    repository = _repository(session_factory)

    result = repository.approve_trade(
        "trade-1", "user-c", TradeApprovalDecision.APPROVED, "Approved"
    )

    assert result is None
    with engine.connect() as connection:
        active = list(
            connection.execute(
                text(
                    "SELECT player_id, draft_team_id, roster_slot_id "
                    "FROM squad_ownerships WHERE ended_at IS NULL"
                )
            )
        )
        approval = connection.execute(
            text("SELECT decision FROM trade_approvals WHERE trade_id = 'trade-1'")
        ).scalar_one()
        status = connection.execute(
            text("SELECT approval_status FROM trade_proposals WHERE id = 'trade-1'")
        ).scalar_one()
        old_rows = connection.execute(
            text("SELECT COUNT(*) FROM squad_ownerships WHERE ended_at IS NOT NULL")
        ).scalar_one()
    assert {(row.player_id, row.draft_team_id) for row in active} == {
        ("a-0", "team-b"),
        ("b-0", "team-a"),
    }
    assert all(row.roster_slot_id for row in active)
    assert approval == "approved"
    assert status == TradeApprovalStatus.APPROVED.value
    assert old_rows == 2
    with pytest.raises(ValueError, match="participant"):
        repository.approve_trade("trade-1", "user-a", TradeApprovalDecision.APPROVED, None)
    with pytest.raises(ValueError, match="requires a commissioner"):
        repository.approve_trade("trade-1", "user-v", TradeApprovalDecision.APPROVED, None)


def test_postgres_trade_approval_rejects_participant_and_wrong_role_without_mutation(
    trade_database: tuple[Engine, sessionmaker[Session]],
) -> None:
    engine, session_factory = trade_database
    _seed_trade(session_factory)
    repository = _repository(session_factory)

    with pytest.raises(ValueError, match="participant"):
        repository.approve_trade("trade-1", "user-a", TradeApprovalDecision.APPROVED, None)
    with pytest.raises(ValueError, match="requires a commissioner"):
        repository.approve_trade("trade-1", "user-v", TradeApprovalDecision.APPROVED, None)

    with engine.connect() as connection:
        status = connection.execute(
            text("SELECT approval_status FROM trade_proposals WHERE id = 'trade-1'")
        ).scalar_one()
        active_count = connection.execute(
            text("SELECT COUNT(*) FROM squad_ownerships WHERE ended_at IS NULL")
        ).scalar_one()
        approvals = connection.execute(text("SELECT COUNT(*) FROM trade_approvals")).scalar_one()
    assert status == TradeApprovalStatus.PENDING.value
    assert active_count == 2
    assert approvals == 0


def test_postgres_trade_roster_cap_failure_rolls_back_ownership_and_approval(
    trade_database: tuple[Engine, sessionmaker[Session]],
) -> None:
    engine, session_factory = trade_database
    _seed_trade(session_factory, asset_count=2, team_b_size=20)
    repository = _repository(session_factory)

    with pytest.raises(ValueError, match="20-player"):
        repository.approve_trade("trade-1", "user-c", TradeApprovalDecision.APPROVED, None)

    with engine.connect() as connection:
        status = connection.execute(
            text("SELECT approval_status FROM trade_proposals WHERE id = 'trade-1'")
        ).scalar_one()
        active = connection.execute(
            text("SELECT COUNT(*) FROM squad_ownerships WHERE ended_at IS NULL")
        ).scalar_one()
        approvals = connection.execute(text("SELECT COUNT(*) FROM trade_approvals")).scalar_one()
        audit = connection.execute(text("SELECT COUNT(*) FROM squad_audit_events")).scalar_one()
    assert status == TradeApprovalStatus.PENDING.value
    assert active == 22
    assert approvals == 0
    assert audit == 0


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_postgres_trade_approval_transaction_and_received_squad_players(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(engine)
    suffix = uuid4().hex[:10]
    league_id = LEAGUE_ID
    season_id = SEASON_ID
    manager_a, manager_b = f"movement-a-{suffix}", f"movement-b-{suffix}"
    commissioner, vice = f"movement-c-{suffix}", f"movement-v-{suffix}"
    team_a, team_b = f"movement-ta-{suffix}", f"movement-tb-{suffix}"
    position_def, position_mid = f"MDEF{suffix[:4]}", f"MMID{suffix[:4]}"
    player_a, player_b = f"movement-pa-{suffix}", f"movement-pb-{suffix}"
    slot_a_def, slot_a_mid = f"movement-sad-{suffix}", f"movement-sam-{suffix}"
    slot_b_def, slot_b_mid = f"movement-sbd-{suffix}", f"movement-sbm-{suffix}"
    trade_id = f"movement-trade-{suffix}"
    now = datetime.now(UTC)
    monkeypatch.setattr(
        PostgreSQLTeamSelectionRepository,
        "repair_unlocked_lineups",
        staticmethod(lambda _session, _team_id, _owned_ids, _now: None),
    )
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO managers (id, display_name) VALUES (:id, :name)"),
            [
                {"id": manager_a, "name": "Manager A"},
                {"id": manager_b, "name": "Manager B"},
                {"id": commissioner, "name": "Commissioner"},
                {"id": vice, "name": "Vice commissioner"},
            ],
        )
        connection.execute(
            text(
                "INSERT INTO draft_teams (id, league_id, manager_id, name) "
                "VALUES (:id, :league, :manager, :name)"
            ),
            [
                {"id": team_a, "league": league_id, "manager": manager_a, "name": "A"},
                {"id": team_b, "league": league_id, "manager": manager_b, "name": "B"},
            ],
        )
        connection.execute(
            text(
                "INSERT INTO league_memberships (id, league_id, manager_id, role) "
                "VALUES (:id, :league, :manager, :role)"
            ),
            [
                {
                    "id": f"m-a-{suffix}",
                    "league": league_id,
                    "manager": manager_a,
                    "role": "manager",
                },
                {
                    "id": f"m-b-{suffix}",
                    "league": league_id,
                    "manager": manager_b,
                    "role": "manager",
                },
                {
                    "id": f"m-c-{suffix}",
                    "league": league_id,
                    "manager": commissioner,
                    "role": "commissioner",
                },
                {
                    "id": f"m-v-{suffix}",
                    "league": league_id,
                    "manager": vice,
                    "role": "vice_commissioner",
                },
            ],
        )
        connection.execute(
            text(
                "INSERT INTO fpl_positions (id, singular_name, plural_name) "
                "VALUES (:id, :name, :plural)"
            ),
            [
                {"id": position_def, "name": "Defender", "plural": "Defenders"},
                {"id": position_mid, "name": "Midfielder", "plural": "Midfielders"},
            ],
        )
        connection.execute(
            text("INSERT INTO epl_teams (id, short_name, name) VALUES (:id, :short, :name)"),
            {"id": f"movement-epl-{suffix}", "short": "MOV", "name": "Movement FC"},
        )
        connection.execute(
            text(
                "INSERT INTO fpl_players "
                "(id, first_name, second_name, web_name, position_id, team_id) "
                "VALUES (:id, :first, :second, :web, :position, :team)"
            ),
            [
                {
                    "id": player_a,
                    "first": "A",
                    "second": "Mid",
                    "web": "A Mid",
                    "position": position_mid,
                    "team": f"movement-epl-{suffix}",
                },
                {
                    "id": player_b,
                    "first": "B",
                    "second": "Def",
                    "web": "B Def",
                    "position": position_def,
                    "team": f"movement-epl-{suffix}",
                },
            ],
        )
        connection.execute(
            text(
                "INSERT INTO fpl_player_values (id, player_id, gameweek, value) "
                "VALUES (:id, :player, 1, 50)"
            ),
            [
                {"id": f"value-a-{suffix}", "player": player_a},
                {"id": f"value-b-{suffix}", "player": player_b},
            ],
        )
        connection.execute(
            text(
                "INSERT INTO squad_roster_slots "
                "(id, season_id, draft_team_id, slot_key, position_id, sort_order, is_required) "
                "VALUES (:id, :season, :team, :key, :position, :order, false)"
            ),
            [
                {
                    "id": slot_a_def,
                    "season": season_id,
                    "team": team_a,
                    "key": "DEF-1",
                    "position": position_def,
                    "order": 1,
                },
                {
                    "id": slot_a_mid,
                    "season": season_id,
                    "team": team_a,
                    "key": "MID-1",
                    "position": position_mid,
                    "order": 2,
                },
                {
                    "id": slot_b_def,
                    "season": season_id,
                    "team": team_b,
                    "key": "DEF-1",
                    "position": position_def,
                    "order": 1,
                },
                {
                    "id": slot_b_mid,
                    "season": season_id,
                    "team": team_b,
                    "key": "MID-1",
                    "position": position_mid,
                    "order": 2,
                },
            ],
        )
        connection.execute(
            text(
                "INSERT INTO squad_ownerships "
                "(id, season_id, draft_team_id, player_id, roster_slot_id, started_at, ended_at) "
                "VALUES (:id, :season, :team, :player, :slot, :started, NULL)"
            ),
            [
                {
                    "id": f"ownership-a-{suffix}",
                    "season": season_id,
                    "team": team_a,
                    "player": player_a,
                    "slot": slot_a_mid,
                    "started": now,
                },
                {
                    "id": f"ownership-b-{suffix}",
                    "season": season_id,
                    "team": team_b,
                    "player": player_b,
                    "slot": slot_b_def,
                    "started": now,
                },
            ],
        )
        connection.execute(
            text(
                "INSERT INTO trade_proposals "
                "(id, season_id, offered_by_team_id, offered_to_team_id, gameweek, status, "
                "approval_status, required_approver_role, created_at, updated_at) "
                "VALUES (:id, :season, :from_team, :to_team, 1, 'accepted', "
                "'pending', 'commissioner', :now, :now)"
            ),
            {
                "id": trade_id,
                "season": season_id,
                "from_team": team_a,
                "to_team": team_b,
                "now": now,
            },
        )
        connection.execute(
            text(
                "INSERT INTO trade_assets (id, trade_id, player_id, from_team_id, to_team_id) "
                "VALUES (:id, :trade, :player, :source, :target)"
            ),
            [
                {
                    "id": f"asset-a-{suffix}",
                    "trade": trade_id,
                    "player": player_a,
                    "source": team_a,
                    "target": team_b,
                },
                {
                    "id": f"asset-b-{suffix}",
                    "trade": trade_id,
                    "player": player_b,
                    "source": team_b,
                    "target": team_a,
                },
            ],
        )

    repository = PostgreSQLSquadRepository(session_factory)
    try:
        with pytest.raises(ValueError, match="participant"):
            repository.approve_trade(trade_id, manager_a, TradeApprovalDecision.APPROVED, None)
        with pytest.raises(ValueError, match="requires a commissioner"):
            repository.approve_trade(trade_id, vice, TradeApprovalDecision.APPROVED, None)

        with session_factory.begin() as session:
            session.execute(
                text("UPDATE squad_ownerships SET ended_at = :now WHERE id = :id"),
                {"now": now, "id": f"ownership-a-{suffix}"},
            )
        with pytest.raises(ValueError, match="no longer owned"):
            repository.approve_trade(trade_id, commissioner, TradeApprovalDecision.APPROVED, None)
        with session_factory() as session:
            pending = session.execute(
                text("SELECT approval_status FROM trade_proposals WHERE id = :id"), {"id": trade_id}
            ).scalar_one()
            approval_count = session.execute(
                text("SELECT COUNT(*) FROM trade_approvals WHERE trade_id = :id"), {"id": trade_id}
            ).scalar_one()
        assert pending == "pending"
        assert approval_count == 0

        with session_factory.begin() as session:
            session.execute(
                text("UPDATE squad_ownerships SET ended_at = NULL WHERE id = :id"),
                {"id": f"ownership-a-{suffix}"},
            )
        repository.approve_trade(trade_id, commissioner, TradeApprovalDecision.APPROVED, "ok")
        audit = repository.trade_audit(trade_id, commissioner)
        assert audit is not None and audit[0].action == "trade_executed"
        assert repository.trade_audit(trade_id, "unrelated-user") is None
        with session_factory() as session:
            active = list(
                session.execute(
                    text(
                        "SELECT player_id, draft_team_id, roster_slot_id FROM squad_ownerships "
                        "WHERE season_id = :season AND draft_team_id IN (:team_a, :team_b) "
                        "AND ended_at IS NULL"
                    ),
                    {"season": season_id, "team_a": team_a, "team_b": team_b},
                )
            )
        assert {(row.player_id, row.draft_team_id) for row in active} == {
            (player_a, team_b),
            (player_b, team_a),
        }
        assert all(row.roster_slot_id for row in active)
        squad = repository.list_squad_players()
        assert {player.id for player in squad} >= {player_a, player_b}
        repository.manager_team = TeamSummary(id=team_b, name="B")
        summary = SquadManagementService(repository).get_summary()
        assert player_a in {player.id for player in summary.players}
        selection_repository = PostgreSQLTeamSelectionRepository(session_factory)
        selection_repository.manager_team = TeamSummary(id=team_b, name="B")
        selection = TeamSelectionService(selection_repository).get_team_selection()
        assert player_a in {player.id for player in selection.lineup}
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM squad_audit_events WHERE subject_id = :id"), {"id": trade_id}
            )
            connection.execute(
                text("DELETE FROM trade_approvals WHERE trade_id = :id"), {"id": trade_id}
            )
            connection.execute(
                text("DELETE FROM trade_assets WHERE trade_id = :id"), {"id": trade_id}
            )
            connection.execute(text("DELETE FROM trade_proposals WHERE id = :id"), {"id": trade_id})
            connection.execute(
                text("DELETE FROM squad_ownerships WHERE season_id = :id"), {"id": season_id}
            )
            connection.execute(
                text("DELETE FROM squad_roster_slots WHERE season_id = :id"), {"id": season_id}
            )
            connection.execute(
                text("DELETE FROM fpl_player_values WHERE player_id IN (:a, :b)"),
                {"a": player_a, "b": player_b},
            )
            connection.execute(
                text("DELETE FROM fpl_players WHERE id IN (:a, :b)"), {"a": player_a, "b": player_b}
            )
            connection.execute(
                text("DELETE FROM fpl_positions WHERE id IN (:def, :mid)"),
                {"def": position_def, "mid": position_mid},
            )
            connection.execute(
                text("DELETE FROM epl_teams WHERE id = :id"), {"id": f"movement-epl-{suffix}"}
            )
            connection.execute(
                text("DELETE FROM league_memberships WHERE league_id = :id"), {"id": league_id}
            )
            connection.execute(
                text("DELETE FROM draft_teams WHERE league_id = :id"), {"id": league_id}
            )
            connection.execute(
                text("DELETE FROM managers WHERE id IN (:a, :b, :c, :v)"),
                {"a": manager_a, "b": manager_b, "c": commissioner, "v": vice},
            )
        engine.dispose()
