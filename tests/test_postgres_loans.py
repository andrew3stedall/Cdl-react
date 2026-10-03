"""PostgreSQL integration coverage for persistent loan approval and ownership."""

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.contracts.loans import LoanCreateRequest, LoanStatus
from cdl_api.contracts.squad import TradeApprovalDecision
from cdl_api.repositories.loans import PostgreSQLLoanRepository
from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository
from cdl_api.staging_draft_seed import LEAGUE_ID, SEASON_ID


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_postgres_loan_approval_moves_ownership_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    session_factory = sessionmaker(engine, class_=Session)
    suffix = uuid4().hex[:10]
    lender_manager, borrower_manager, commissioner = (
        f"loan-lender-{suffix}",
        f"loan-borrower-{suffix}",
        f"loan-commissioner-{suffix}",
    )
    lender_team, borrower_team = f"loan-team-a-{suffix}", f"loan-team-b-{suffix}"
    player_id, position_id, slot_id = (
        f"loan-player-{suffix}",
        f"LOAN{suffix[:4]}",
        f"loan-slot-a-{suffix}",
    )
    borrower_slot_id = f"loan-slot-b-{suffix}"
    loan_id = None
    inserted_gameweek = None
    previous_gameweek_deadline = None
    selected_gameweek = None
    prior_next_gameweeks: list[str] = []
    monkeypatch.setattr(
        PostgreSQLTeamSelectionRepository,
        "repair_unlocked_lineups",
        staticmethod(lambda _session, _team_id, _owned_ids, _now: None),
        raising=False,
    )
    try:
        with engine.begin() as connection:
            season_end = connection.execute(
                text("SELECT end_gameweek FROM seasons WHERE id = :id"), {"id": SEASON_ID}
            ).scalar_one()
            prior_next_gameweeks = list(
                connection.execute(
                    text("SELECT id FROM fpl_gameweeks WHERE is_next IS TRUE")
                ).scalars()
            )
            gameweek = connection.execute(
                text(
                    "SELECT id FROM fpl_gameweeks WHERE CAST(id AS INTEGER) BETWEEN 1 AND :end "
                    "ORDER BY CAST(id AS INTEGER) LIMIT 1"
                ),
                {"end": season_end},
            ).scalar_one_or_none()
            if gameweek is None:
                inserted_gameweek = "1"
                connection.execute(
                    text(
                        "INSERT INTO fpl_gameweeks "
                        "(id, name, deadline_time, is_previous, is_current, is_next, "
                        "finished, data_checked) "
                        "VALUES ('1', 'Loan test', :deadline, FALSE, FALSE, TRUE, FALSE, FALSE)"
                    ),
                    {"deadline": datetime.now(UTC) + timedelta(days=30)},
                )
                gameweek = inserted_gameweek
            else:
                selected_gameweek = str(gameweek)
                previous_gameweek_deadline = connection.execute(
                    text("SELECT deadline_time FROM fpl_gameweeks WHERE id = :id"),
                    {"id": selected_gameweek},
                ).scalar_one()
                connection.execute(text("UPDATE fpl_gameweeks SET is_next = FALSE"))
                connection.execute(
                    text(
                        "UPDATE fpl_gameweeks SET is_next = TRUE, deadline_time = :deadline "
                        "WHERE id = :id"
                    ),
                    {"id": gameweek, "deadline": datetime.now(UTC) + timedelta(days=30)},
                )
            epl_team = connection.execute(
                text("SELECT id FROM epl_teams ORDER BY id LIMIT 1")
            ).scalar_one()
            connection.execute(
                text(
                    "INSERT INTO fpl_positions (id, singular_name, plural_name) "
                    "VALUES (:id, 'midfielder', 'midfielders')"
                ),
                {"id": position_id},
            )
            connection.execute(
                text(
                    "INSERT INTO fpl_players "
                    "(id, first_name, second_name, web_name, position_id, team_id) "
                    "VALUES (:id, 'Loan', 'Player', 'Loan Player', :position, :team)"
                ),
                {"id": player_id, "position": position_id, "team": epl_team},
            )
            connection.execute(
                text("INSERT INTO managers (id, display_name) VALUES (:id, :name)"),
                [
                    {"id": lender_manager, "name": "Loan lender"},
                    {"id": borrower_manager, "name": "Loan borrower"},
                    {"id": commissioner, "name": "Loan commissioner"},
                ],
            )
            connection.execute(
                text(
                    "INSERT INTO draft_teams (id, league_id, manager_id, name) "
                    "VALUES (:lender, :league, :lm, 'Loan lender'), "
                    "(:borrower, :league, :bm, 'Loan borrower')"
                ),
                {
                    "lender": lender_team,
                    "borrower": borrower_team,
                    "league": LEAGUE_ID,
                    "lm": lender_manager,
                    "bm": borrower_manager,
                },
            )
            connection.execute(
                text(
                    "INSERT INTO league_memberships (id, league_id, manager_id, role) "
                    "VALUES (:la, :league, :lm, 'manager'), (:lb, :league, :bm, 'manager'), "
                    "(:lc, :league, :cm, 'commissioner')"
                ),
                {
                    "la": f"loan-membership-a-{suffix}",
                    "lb": f"loan-membership-b-{suffix}",
                    "lc": f"loan-membership-c-{suffix}",
                    "league": LEAGUE_ID,
                    "lm": lender_manager,
                    "bm": borrower_manager,
                    "cm": commissioner,
                },
            )
            connection.execute(
                text(
                    "INSERT INTO squad_roster_slots "
                    "(id, season_id, draft_team_id, slot_key, position_id, sort_order) "
                    "VALUES (:id, :season, :team, 'MID1', :position, 1), "
                    "(:borrower_slot, :season, :borrower, 'MID1', :position, 1)"
                ),
                {
                    "id": slot_id,
                    "borrower_slot": borrower_slot_id,
                    "season": SEASON_ID,
                    "team": lender_team,
                    "borrower": borrower_team,
                    "position": position_id,
                },
            )
            connection.execute(
                text(
                    "INSERT INTO squad_ownerships "
                    "(id, season_id, draft_team_id, player_id, roster_slot_id, started_at) "
                    "VALUES (:id, :season, :team, :player, :slot, :now)"
                ),
                {
                    "id": f"loan-ownership-{suffix}",
                    "season": SEASON_ID,
                    "team": lender_team,
                    "player": player_id,
                    "slot": slot_id,
                    "now": datetime.now(UTC),
                },
            )

        lender = PostgreSQLLoanRepository(
            session_factory, lender_manager, lender_manager, lender_team
        )
        borrower = PostgreSQLLoanRepository(
            session_factory, borrower_manager, borrower_manager, borrower_team
        )
        approver = PostgreSQLLoanRepository(
            session_factory, commissioner, commissioner, lender_team
        )
        proposal = lender.create(
            LoanCreateRequest(player_id=player_id, borrower_team_id=borrower_team)
        )
        loan_id = proposal.id
        agreed = borrower.update_party_status(proposal.id, LoanStatus.AGREED)
        assert agreed is not None and agreed.approval_status.value == "pending"
        active = approver.approve(proposal.id, TradeApprovalDecision.APPROVED, None)
        assert active is not None and active.status == LoanStatus.ACTIVE
        assert approver.approve(proposal.id, TradeApprovalDecision.APPROVED, None) == active
        with engine.connect() as connection:
            ownership = connection.execute(
                text(
                    "SELECT draft_team_id FROM squad_ownerships "
                    "WHERE season_id = :season AND player_id = :player AND ended_at IS NULL"
                ),
                {"season": SEASON_ID, "player": player_id},
            ).scalar_one()
            loan_event_count = connection.execute(
                text(
                    "SELECT COUNT(*) FROM loan_events "
                    "WHERE loan_id = :id AND action = 'loan_started'"
                ),
                {"id": loan_id},
            ).scalar_one()
        assert ownership == borrower_team
        assert loan_event_count == 1
    finally:
        with engine.begin() as connection:
            if loan_id is not None:
                connection.execute(
                    text("DELETE FROM loan_events WHERE loan_id = :id"), {"id": loan_id}
                )
                connection.execute(text("DELETE FROM loans WHERE id = :id"), {"id": loan_id})
            connection.execute(
                text("DELETE FROM squad_ownerships WHERE player_id = :id"), {"id": player_id}
            )
            connection.execute(
                text("DELETE FROM squad_roster_slots WHERE id IN (:a, :b)"),
                {"a": slot_id, "b": borrower_slot_id},
            )
            connection.execute(text("DELETE FROM fpl_players WHERE id = :id"), {"id": player_id})
            connection.execute(
                text("DELETE FROM fpl_positions WHERE id = :id"), {"id": position_id}
            )
            connection.execute(
                text("DELETE FROM league_memberships WHERE id IN (:a, :b, :c)"),
                {
                    "a": f"loan-membership-a-{suffix}",
                    "b": f"loan-membership-b-{suffix}",
                    "c": f"loan-membership-c-{suffix}",
                },
            )
            connection.execute(
                text("DELETE FROM draft_teams WHERE id IN (:a, :b)"),
                {"a": lender_team, "b": borrower_team},
            )
            connection.execute(
                text("DELETE FROM managers WHERE id IN (:a, :b, :c)"),
                {"a": lender_manager, "b": borrower_manager, "c": commissioner},
            )
            connection.execute(text("UPDATE fpl_gameweeks SET is_next = FALSE"))
            for gameweek_id in prior_next_gameweeks:
                connection.execute(
                    text("UPDATE fpl_gameweeks SET is_next = TRUE WHERE id = :id"),
                    {"id": gameweek_id},
                )
            if inserted_gameweek is not None:
                connection.execute(
                    text("DELETE FROM fpl_gameweeks WHERE id = :id"),
                    {"id": inserted_gameweek},
                )
            elif selected_gameweek is not None:
                connection.execute(
                    text("UPDATE fpl_gameweeks SET deadline_time = :deadline WHERE id = :id"),
                    {"id": selected_gameweek, "deadline": previous_gameweek_deadline},
                )
        engine.dispose()
