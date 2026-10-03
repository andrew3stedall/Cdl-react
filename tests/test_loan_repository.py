from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.contracts.domain import TeamSummary
from cdl_api.contracts.loans import LoanCreateRequest, LoanStatus
from cdl_api.contracts.squad import TradeApprovalDecision
from cdl_api.repositories.loans import PostgreSQLLoanRepository
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository
from cdl_api.services.live_draft import LiveDraftError
from cdl_api.staging_draft_seed import SEASON_ID


@pytest.fixture
def loan_database(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[Engine, sessionmaker[Session]]]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    session_factory = sessionmaker(engine)
    ddl = (
        "CREATE TABLE managers (id TEXT PRIMARY KEY, user_id TEXT, display_name TEXT)",
        """CREATE TABLE draft_teams (
            id TEXT PRIMARY KEY, league_id TEXT, manager_id TEXT, name TEXT
        )""",
        """CREATE TABLE league_memberships (
            id TEXT PRIMARY KEY, league_id TEXT, manager_id TEXT, role TEXT
        )""",
        "CREATE TABLE seasons (id TEXT PRIMARY KEY, end_gameweek INTEGER)",
        "CREATE TABLE live_drafts (id TEXT PRIMARY KEY, season_id TEXT, status TEXT)",
        "CREATE TABLE fpl_positions (id TEXT PRIMARY KEY, singular_name TEXT)",
        "CREATE TABLE fpl_players (id TEXT PRIMARY KEY, position_id TEXT, web_name TEXT)",
        """CREATE TABLE fpl_gameweeks (
            id TEXT PRIMARY KEY, deadline_time TIMESTAMP, is_next BOOLEAN, finished BOOLEAN
        )""",
        """CREATE TABLE squad_roster_slots (
            id TEXT PRIMARY KEY, season_id TEXT, draft_team_id TEXT,
            position_id TEXT, sort_order INTEGER
        )""",
        """CREATE TABLE squad_ownerships (
            id TEXT PRIMARY KEY, season_id TEXT, draft_team_id TEXT, player_id TEXT,
            roster_slot_id TEXT, started_at TIMESTAMP, ended_at TIMESTAMP
        )""",
        """CREATE TABLE player_rights (
            id TEXT PRIMARY KEY, season_id TEXT, draft_team_id TEXT, player_id TEXT,
            right_type TEXT, source_ref TEXT, acquired_at TIMESTAMP,
            expires_at TIMESTAMP, released_at TIMESTAMP
        )""",
        """CREATE TABLE loans (
            id TEXT PRIMARY KEY, season_id TEXT, player_id TEXT, lender_team_id TEXT,
            borrower_team_id TEXT, created_by_manager_id TEXT, agreed_by_manager_id TEXT,
            status TEXT, approval_status TEXT, required_approver_role TEXT,
            approved_by_manager_id TEXT, duration_gameweeks INTEGER, start_gameweek INTEGER,
            due_gameweek INTEGER, lender_roster_slot_id TEXT, created_at TIMESTAMP,
            updated_at TIMESTAMP, approved_at TIMESTAMP, returned_at TIMESTAMP
        )""",
        """CREATE TABLE loan_events (
            id TEXT PRIMARY KEY, loan_id TEXT, actor_manager_id TEXT, action TEXT,
            created_at TIMESTAMP, metadata_json JSON
        )""",
    )
    with engine.begin() as connection:
        for statement in ddl:
            connection.execute(text(statement))
        connection.execute(text("INSERT INTO seasons VALUES (:id, 5)"), {"id": SEASON_ID})
        connection.execute(text("INSERT INTO fpl_positions VALUES ('MID', 'midfielder')"))
        connection.execute(text("INSERT INTO fpl_players VALUES ('player', 'MID', 'Player')"))
        connection.execute(
            text("INSERT INTO fpl_gameweeks VALUES ('3', :deadline, TRUE, FALSE)"),
            {"deadline": datetime.now(UTC) + timedelta(days=4)},
        )
        connection.execute(
            text(
                """INSERT INTO managers VALUES
                    ('lender', 'lender', 'Lender'),
                    ('borrower', 'borrower', 'Borrower'),
                    ('commissioner', 'commissioner', 'Commissioner')"""
            )
        )
        connection.execute(
            text(
                """INSERT INTO draft_teams VALUES
                    ('team-a', 'league', 'lender', 'A'),
                    ('team-b', 'league', 'borrower', 'B')"""
            )
        )
        connection.execute(
            text(
                """INSERT INTO league_memberships VALUES
                    ('m-a', 'league', 'lender', 'manager'),
                    ('m-b', 'league', 'borrower', 'manager'),
                    ('m-c', 'league', 'commissioner', 'commissioner')"""
            )
        )
        connection.execute(
            text(
                """INSERT INTO squad_roster_slots VALUES
                    ('slot-a', :season, 'team-a', 'MID', 1),
                    ('slot-b', :season, 'team-b', 'MID', 1)"""
            ),
            {"season": SEASON_ID},
        )
        connection.execute(
            text(
                """INSERT INTO squad_ownerships
                    VALUES ('own-a', :season, 'team-a', 'player', 'slot-a', :now, NULL)"""
            ),
            {"season": SEASON_ID, "now": datetime.now(UTC)},
        )
    monkeypatch.setattr(
        PostgreSQLTeamSelectionRepository,
        "repair_unlocked_lineups",
        staticmethod(lambda _session, _team_id, _owned_ids, _now: None),
        raising=False,
    )
    try:
        yield engine, session_factory
    finally:
        engine.dispose()


def test_loan_agreement_approval_and_scheduled_return_are_transactional_and_idempotent(
    loan_database: tuple[Engine, sessionmaker[Session]],
) -> None:
    engine, session_factory = loan_database
    lender = PostgreSQLLoanRepository(session_factory, "lender", "lender", "team-a")
    borrower = PostgreSQLLoanRepository(session_factory, "borrower", "borrower", "team-b")
    commissioner = PostgreSQLLoanRepository(
        session_factory, "commissioner", "commissioner", "team-a"
    )

    proposal = lender.create(LoanCreateRequest(player_id="player", borrower_team_id="team-b"))
    assert proposal.status == LoanStatus.PROPOSED
    assert proposal.duration_gameweeks == 4
    agreed = borrower.update_party_status(proposal.id, LoanStatus.AGREED)
    assert agreed is not None
    assert agreed.approval_status.value == "pending"

    active = commissioner.approve(proposal.id, TradeApprovalDecision.APPROVED, "Agreed")
    assert active is not None
    assert active.status == LoanStatus.ACTIVE
    assert active.start_gameweek == 3
    assert active.due_gameweek == 5
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO live_drafts VALUES ('draft-1', :season, 'active')"),
            {"season": SEASON_ID},
        )
        assert (
            connection.execute(
                text("SELECT draft_team_id FROM squad_ownerships WHERE ended_at IS NULL")
            ).scalar_one()
            == "team-b"
        )
        connection.execute(text("UPDATE fpl_gameweeks SET is_next = FALSE WHERE id = '3'"))
        connection.execute(text("INSERT INTO fpl_gameweeks VALUES ('5', NULL, FALSE, TRUE)"))
    with engine.connect() as connection:
        assert not connection.execute(
            text("SELECT is_next FROM fpl_gameweeks WHERE id = '3'")
        ).scalar_one()
        assert connection.execute(
            text("SELECT finished FROM fpl_gameweeks WHERE id = '5'")
        ).scalar_one()

    assert lender.process_due_returns() == 1
    assert lender.process_due_returns() == 0
    returned = lender.get(proposal.id)
    assert returned is not None and returned.status == LoanStatus.RETURNED
    with engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT draft_team_id FROM squad_ownerships WHERE ended_at IS NULL")
            ).scalar_one()
            == "team-a"
        )
        actions = (
            connection.execute(
                text("SELECT action FROM loan_events WHERE loan_id = :id ORDER BY created_at, id"),
                {"id": proposal.id},
            )
            .scalars()
            .all()
        )
    assert actions.count("loan_returned") == 1


def test_loan_approval_waits_for_live_draft_but_scheduled_return_can_unwind(
    loan_database: tuple[Engine, sessionmaker[Session]],
) -> None:
    engine, session_factory = loan_database
    lender = PostgreSQLLoanRepository(session_factory, "lender", "lender", "team-a")
    borrower = PostgreSQLLoanRepository(session_factory, "borrower", "borrower", "team-b")
    commissioner = PostgreSQLLoanRepository(
        session_factory, "commissioner", "commissioner", "team-a"
    )
    proposal = lender.create(LoanCreateRequest(player_id="player", borrower_team_id="team-b"))
    borrower.update_party_status(proposal.id, LoanStatus.AGREED)
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO live_drafts VALUES ('draft-1', :season, 'active')"),
            {"season": SEASON_ID},
        )

    with pytest.raises(LiveDraftError, match="draft is in progress"):
        commissioner.approve(proposal.id, TradeApprovalDecision.APPROVED, None)
    with engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT status FROM loans WHERE id = :id"), {"id": proposal.id}
            ).scalar_one()
            == LoanStatus.AGREED.value
        )
        assert (
            connection.execute(
                text("SELECT draft_team_id FROM squad_ownerships WHERE ended_at IS NULL")
            ).scalar_one()
            == "team-a"
        )

    # Once approved after the draft, an already scheduled return remains available
    # while a later live draft is in progress so obligations can always unwind.
    with engine.begin() as connection:
        connection.execute(text("UPDATE live_drafts SET status = 'complete'"))
    active = commissioner.approve(proposal.id, TradeApprovalDecision.APPROVED, None)
    assert active is not None and active.status == LoanStatus.ACTIVE
    with engine.begin() as connection:
        connection.execute(text("UPDATE live_drafts SET status = 'active'"))
        connection.execute(text("UPDATE fpl_gameweeks SET is_next = FALSE WHERE id = '3'"))
        connection.execute(text("INSERT INTO fpl_gameweeks VALUES ('5', NULL, FALSE, TRUE)"))
    assert lender.process_due_returns() == 1


def test_borrower_position_cap_counts_active_players_loaned_out(
    loan_database: tuple[Engine, sessionmaker[Session]],
) -> None:
    engine, session_factory = loan_database
    borrower = PostgreSQLLoanRepository(session_factory, "borrower", "borrower", "team-b")
    lender = PostgreSQLLoanRepository(session_factory, "lender", "lender", "team-a")
    commissioner = PostgreSQLLoanRepository(
        session_factory, "commissioner", "commissioner", "team-a"
    )
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO fpl_players VALUES (:id, 'MID', :name)"),
            [{"id": f"owned-{index}", "name": f"Owned {index}"} for index in range(9)]
            + [{"id": "outgoing", "name": "Outgoing loan"}],
        )
        connection.execute(
            text(
                "INSERT INTO squad_ownerships "
                "(id, season_id, draft_team_id, player_id, roster_slot_id, started_at) "
                "VALUES (:id, :season, 'team-b', :player, NULL, :now)"
            ),
            [
                {
                    "id": f"own-b-{index}",
                    "season": SEASON_ID,
                    "player": f"owned-{index}",
                    "now": datetime.now(UTC),
                }
                for index in range(9)
            ],
        )
        connection.execute(
            text(
                "INSERT INTO loans (id, season_id, player_id, lender_team_id, status) "
                "VALUES ('active-out', :season, 'outgoing', 'team-b', 'active')"
            ),
            {"season": SEASON_ID},
        )

    proposal = lender.create(LoanCreateRequest(player_id="player", borrower_team_id="team-b"))
    borrower.update_party_status(proposal.id, LoanStatus.AGREED)
    with pytest.raises(ValueError, match="position limit"):
        commissioner.approve(proposal.id, TradeApprovalDecision.APPROVED, None)
    with engine.connect() as connection:
        status_row = connection.execute(
            text("SELECT status, approval_status FROM loans WHERE id = :id"),
            {"id": proposal.id},
        ).one()
        lender_still_owns = connection.execute(
            text(
                "SELECT COUNT(*) FROM squad_ownerships "
                "WHERE draft_team_id = 'team-a' AND player_id = 'player' AND ended_at IS NULL"
            )
        ).scalar_one()
    assert status_row == (LoanStatus.AGREED.value, "pending")
    assert lender_still_owns == 1


def test_active_borrowed_player_cannot_be_removed_early(
    loan_database: tuple[Engine, sessionmaker[Session]],
) -> None:
    engine, session_factory = loan_database
    repository = PostgreSQLSquadRepository.__new__(PostgreSQLSquadRepository)
    repository._session_factory = session_factory
    repository.manager_team = TeamSummary(id="team-b", name="B")
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO squad_ownerships "
                "(id, season_id, draft_team_id, player_id, roster_slot_id, started_at) "
                "VALUES ('borrowed', :season, 'team-b', 'player', 'slot-b', :now)"
            ),
            {"season": SEASON_ID, "now": datetime.now(UTC)},
        )
        connection.execute(
            text(
                "INSERT INTO player_rights "
                "(id, season_id, draft_team_id, player_id, right_type, acquired_at) "
                "VALUES ('right', :season, 'team-b', 'new-player', 'draw', :now)"
            ),
            {"season": SEASON_ID, "now": datetime.now(UTC)},
        )
        connection.execute(
            text(
                "INSERT INTO loans "
                "(id, season_id, player_id, lender_team_id, borrower_team_id, status) "
                "VALUES ('active-loan', :season, 'player', 'team-a', 'team-b', 'active')"
            ),
            {"season": SEASON_ID},
        )

    with pytest.raises(ValueError, match="active loan player cannot be removed"):
        repository.apply_squad_changes(["new-player"], ["player"])

    with engine.connect() as connection:
        owner = connection.execute(
            text(
                "SELECT draft_team_id FROM squad_ownerships "
                "WHERE player_id = 'player' AND draft_team_id = 'team-b' "
                "AND ended_at IS NULL"
            )
        ).scalar_one()
    assert owner == "team-b"
