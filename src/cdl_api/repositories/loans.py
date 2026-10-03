"""Persistent loan agreements and scheduled return processing."""

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Select, and_, func, insert, or_, select, update
from sqlalchemy.engine import RowMapping
from sqlalchemy.orm import Session

from cdl_api.contracts.loans import (
    LoanAgreementResponse,
    LoanCreateRequest,
    LoanEventResponse,
    LoanStatus,
)
from cdl_api.contracts.squad import TradeApprovalDecision, TradeApprovalStatus
from cdl_api.repositories.postgres_fpl_data import (
    fpl_gameweeks_table,
    next_upcoming_gameweek_number,
)
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    fpl_players_table,
    fpl_positions_table,
    league_memberships_table,
    managers_table,
    seasons_table,
)
from cdl_api.repositories.postgres_squad import (
    loan_events_table,
    loans_table,
    squad_ownerships_table,
    squad_roster_slots_table,
)
from cdl_api.services.live_draft import ensure_squad_moves_allowed
from cdl_api.staging_draft_seed import SEASON_ID

POSITION_LIMITS = {"goalkeeper": 3, "defender": 10, "midfielder": 10, "forward": 4}
borrower_teams_table = draft_teams_table.alias("borrower_team")


class PostgreSQLLoanRepository:
    """Persist party agreement, commissioner approval, and idempotent returns."""

    def __init__(
        self,
        session_factory: Callable[[], Session],
        user_id: str,
        manager_id: str,
        team_id: str,
    ) -> None:
        self._session_factory = session_factory
        self.user_id = user_id
        self.manager_id = manager_id
        self.team_id = team_id
        self.season_id = SEASON_ID

    def create(self, request: LoanCreateRequest) -> LoanAgreementResponse:
        now = datetime.now(UTC)
        loan_id = f"loan-{uuid4().hex[:16]}"
        with self._session_factory() as session:
            season_exists = session.execute(
                select(seasons_table.c.id)
                .where(seasons_table.c.id == self.season_id)
                .with_for_update()
            ).scalar_one_or_none()
            if season_exists is None:
                raise ValueError("Active season could not be found.")
            borrower = (
                session.execute(
                    select(draft_teams_table.c.id, draft_teams_table.c.league_id).where(
                        draft_teams_table.c.id == request.borrower_team_id
                    )
                )
                .mappings()
                .first()
            )
            lender_league_id = session.execute(
                select(draft_teams_table.c.league_id).where(draft_teams_table.c.id == self.team_id)
            ).scalar_one_or_none()
            if borrower is None or lender_league_id is None:
                raise ValueError("Loan team could not be found.")
            if request.borrower_team_id == self.team_id:
                raise ValueError("A loan must move a player to another team.")
            if borrower["league_id"] != lender_league_id:
                raise ValueError("Loan teams must belong to the same league.")
            owned = (
                session.execute(
                    select(
                        squad_ownerships_table.c.id,
                        squad_ownerships_table.c.roster_slot_id,
                    ).where(
                        squad_ownerships_table.c.season_id == self.season_id,
                        squad_ownerships_table.c.draft_team_id == self.team_id,
                        squad_ownerships_table.c.player_id == request.player_id,
                        squad_ownerships_table.c.ended_at.is_(None),
                    )
                )
                .mappings()
                .first()
            )
            if owned is None:
                raise ValueError("The lender must currently own the loan player.")
            existing = session.execute(
                select(loans_table.c.id).where(
                    loans_table.c.season_id == self.season_id,
                    loans_table.c.player_id == request.player_id,
                    loans_table.c.status.in_(
                        [
                            LoanStatus.PROPOSED.value,
                            LoanStatus.AGREED.value,
                            LoanStatus.ACTIVE.value,
                        ]
                    ),
                )
            ).scalar_one_or_none()
            if existing is not None:
                raise ValueError("This player already has an open or active loan.")
            roles = set(
                session.execute(
                    select(league_memberships_table.c.role)
                    .join(
                        draft_teams_table,
                        draft_teams_table.c.manager_id == league_memberships_table.c.manager_id,
                    )
                    .where(
                        draft_teams_table.c.id.in_([self.team_id, request.borrower_team_id]),
                        league_memberships_table.c.league_id == lender_league_id,
                    )
                ).scalars()
            )
            required_role = "vice_commissioner" if "commissioner" in roles else "commissioner"
            session.execute(
                insert(loans_table).values(
                    id=loan_id,
                    season_id=self.season_id,
                    player_id=request.player_id,
                    lender_team_id=self.team_id,
                    borrower_team_id=request.borrower_team_id,
                    created_by_manager_id=self.manager_id,
                    agreed_by_manager_id=None,
                    status=LoanStatus.PROPOSED.value,
                    approval_status=TradeApprovalStatus.NOT_SUBMITTED.value,
                    required_approver_role=required_role,
                    approved_by_manager_id=None,
                    duration_gameweeks=request.duration_gameweeks,
                    start_gameweek=None,
                    due_gameweek=None,
                    lender_roster_slot_id=owned["roster_slot_id"],
                    created_at=now,
                    updated_at=now,
                    approved_at=None,
                    returned_at=None,
                )
            )
            self._event(session, loan_id, "loan_proposed", self.manager_id, now)
            session.commit()
        result = self.get(loan_id)
        if result is None:
            raise ValueError("Loan proposal could not be loaded after creation.")
        return result

    def get(self, loan_id: str) -> LoanAgreementResponse | None:
        with self._session_factory() as session:
            row = self._loan_row(session, loan_id)
        return None if row is None else self._response(row)

    def list_for_manager(self) -> list[LoanAgreementResponse]:
        self.process_due_returns()
        with self._session_factory() as session:
            rows = list(
                session.execute(
                    self._loan_query()
                    .where(
                        or_(
                            loans_table.c.lender_team_id == self.team_id,
                            loans_table.c.borrower_team_id == self.team_id,
                        )
                    )
                    .order_by(loans_table.c.created_at.desc())
                ).mappings()
            )
        return [self._response(row) for row in rows]

    def update_party_status(self, loan_id: str, status: LoanStatus) -> LoanAgreementResponse | None:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            with session.begin():
                loan = (
                    session.execute(
                        select(loans_table)
                        .where(
                            loans_table.c.id == loan_id,
                            loans_table.c.season_id == self.season_id,
                        )
                        .with_for_update()
                    )
                    .mappings()
                    .first()
                )
                if loan is None:
                    return None
                actor_manager_id = self._manager_for_user(session, self.user_id)
                if actor_manager_id is None:
                    raise ValueError("A league manager is required to decide a loan.")
                if loan["status"] != LoanStatus.PROPOSED.value:
                    raise ValueError("Loan is no longer awaiting party agreement.")
                if status not in {LoanStatus.AGREED, LoanStatus.REJECTED, LoanStatus.CANCELLED}:
                    raise ValueError("Invalid loan party decision.")
                required_team = (
                    loan["borrower_team_id"]
                    if status in {LoanStatus.AGREED, LoanStatus.REJECTED}
                    else loan["lender_team_id"]
                )
                owner = session.execute(
                    select(draft_teams_table.c.manager_id).where(
                        draft_teams_table.c.id == required_team
                    )
                ).scalar_one_or_none()
                if owner != actor_manager_id:
                    raise ValueError("Only the responding loan party may decide this offer.")
                approval_status = (
                    TradeApprovalStatus.PENDING
                    if status == LoanStatus.AGREED
                    else TradeApprovalStatus.REJECTED
                    if status == LoanStatus.REJECTED
                    else TradeApprovalStatus.NOT_SUBMITTED
                )
                session.execute(
                    update(loans_table)
                    .where(loans_table.c.id == loan_id, loans_table.c.status == "proposed")
                    .values(
                        status=status.value,
                        approval_status=approval_status.value,
                        agreed_by_manager_id=(
                            actor_manager_id if status == LoanStatus.AGREED else None
                        ),
                        updated_at=now,
                    )
                )
                self._event(
                    session,
                    loan_id,
                    "loan_agreed" if status == LoanStatus.AGREED else f"loan_{status.value}",
                    actor_manager_id,
                    now,
                )
        return self.get(loan_id)

    def approve(
        self, loan_id: str, decision: TradeApprovalDecision, note: str | None
    ) -> LoanAgreementResponse | None:
        now = datetime.now(UTC)
        affected_teams: set[str] = set()
        with self._session_factory() as session:
            with session.begin():
                session.execute(
                    select(seasons_table.c.id)
                    .where(seasons_table.c.id == self.season_id)
                    .with_for_update()
                ).scalar_one_or_none()
                loan = (
                    session.execute(
                        select(loans_table)
                        .where(
                            loans_table.c.id == loan_id,
                            loans_table.c.season_id == self.season_id,
                        )
                        .with_for_update()
                    )
                    .mappings()
                    .first()
                )
                if loan is None:
                    return None
                actor_manager_id = self._manager_for_user(session, self.user_id)
                if actor_manager_id is None:
                    raise ValueError("Approver must be a league member.")
                participants = set(
                    session.execute(
                        select(draft_teams_table.c.manager_id).where(
                            draft_teams_table.c.id.in_(
                                [loan["lender_team_id"], loan["borrower_team_id"]]
                            ),
                            draft_teams_table.c.manager_id.is_not(None),
                        )
                    ).scalars()
                )
                if actor_manager_id in participants:
                    raise ValueError("A loan participant cannot approve their own loan.")
                league_id = session.execute(
                    select(draft_teams_table.c.league_id).where(
                        draft_teams_table.c.id == loan["lender_team_id"]
                    )
                ).scalar_one()
                roles = set(
                    session.execute(
                        select(league_memberships_table.c.role).where(
                            league_memberships_table.c.league_id == league_id,
                            league_memberships_table.c.manager_id == actor_manager_id,
                        )
                    ).scalars()
                )
                if loan["required_approver_role"] not in roles:
                    raise ValueError(f"Loan requires a {loan['required_approver_role']} approver.")
                if (
                    loan["status"] == LoanStatus.ACTIVE.value
                    and loan["approval_status"] == TradeApprovalStatus.APPROVED.value
                ):
                    return self._response(self._loan_row(session, loan_id))
                if (
                    loan["status"] != LoanStatus.AGREED.value
                    or loan["approval_status"] != TradeApprovalStatus.PENDING.value
                ):
                    raise ValueError("Loan must be agreed and pending approval.")
                if decision == TradeApprovalDecision.REJECTED:
                    session.execute(
                        update(loans_table)
                        .where(loans_table.c.id == loan_id)
                        .values(
                            status=LoanStatus.REJECTED.value,
                            approval_status=TradeApprovalStatus.REJECTED.value,
                            approved_by_manager_id=actor_manager_id,
                            approved_at=now,
                            updated_at=now,
                        )
                    )
                    self._event(
                        session, loan_id, "loan_rejected_by_approver", actor_manager_id, now, note
                    )
                else:
                    ensure_squad_moves_allowed(session, self.season_id)
                    lender_team_id = str(loan["lender_team_id"])
                    borrower_team_id = str(loan["borrower_team_id"])
                    player_id = str(loan["player_id"])
                    affected_teams.update([lender_team_id, borrower_team_id])
                    session.execute(
                        select(draft_teams_table.c.id)
                        .where(draft_teams_table.c.id.in_(sorted(affected_teams)))
                        .order_by(draft_teams_table.c.id)
                        .with_for_update()
                    ).all()
                    ownership = (
                        session.execute(
                            select(squad_ownerships_table)
                            .where(
                                squad_ownerships_table.c.season_id == self.season_id,
                                squad_ownerships_table.c.draft_team_id == lender_team_id,
                                squad_ownerships_table.c.player_id == player_id,
                                squad_ownerships_table.c.ended_at.is_(None),
                            )
                            .with_for_update()
                        )
                        .mappings()
                        .first()
                    )
                    if ownership is None:
                        raise ValueError("The lender no longer owns the loan player.")
                    already_active = session.execute(
                        select(loans_table.c.id).where(
                            loans_table.c.season_id == self.season_id,
                            loans_table.c.player_id == player_id,
                            loans_table.c.status == LoanStatus.ACTIVE.value,
                        )
                    ).scalar_one_or_none()
                    if already_active is not None:
                        raise ValueError("The loan player is already on an active loan.")
                    start_gameweek = next_upcoming_gameweek_number(session)
                    if start_gameweek is None:
                        raise ValueError("An upcoming FPL gameweek is required to start a loan.")
                    season_end = session.execute(
                        select(seasons_table.c.end_gameweek).where(
                            seasons_table.c.id == self.season_id
                        )
                    ).scalar_one()
                    if start_gameweek > season_end:
                        raise ValueError("No active gameweeks remain in this season.")
                    effective_duration = min(
                        int(loan["duration_gameweeks"]), int(season_end) - start_gameweek + 1
                    )
                    due_gameweek = start_gameweek + effective_duration - 1
                    player_position = session.execute(
                        select(
                            fpl_players_table.c.position_id,
                            fpl_positions_table.c.singular_name,
                        )
                        .join(
                            fpl_positions_table,
                            fpl_positions_table.c.id == fpl_players_table.c.position_id,
                        )
                        .where(fpl_players_table.c.id == player_id)
                    ).one_or_none()
                    if player_position is None:
                        raise ValueError("Loan player position is unavailable.")
                    position_id, position_name = player_position
                    active_count = self._team_active_count(session, borrower_team_id)
                    outgoing_loan_count = self._active_lender_loan_count(session, borrower_team_id)
                    if active_count + outgoing_loan_count >= 20:
                        raise ValueError("Loan would exceed the borrower's 20-player squad cap.")
                    same_position = self._team_position_count(
                        session, borrower_team_id, str(position_name)
                    )
                    position_limit = POSITION_LIMITS.get(str(position_name).casefold(), 0)
                    if same_position >= position_limit:
                        raise ValueError("Loan would exceed the borrower's position limit.")
                    borrower_slot = self._available_slot(session, borrower_team_id, position_id)
                    session.execute(
                        update(squad_ownerships_table)
                        .where(squad_ownerships_table.c.id == ownership["id"])
                        .values(ended_at=now)
                    )
                    session.execute(
                        insert(squad_ownerships_table).values(
                            id=f"ownership-loan-{uuid4().hex[:12]}",
                            season_id=self.season_id,
                            draft_team_id=borrower_team_id,
                            player_id=player_id,
                            roster_slot_id=borrower_slot,
                            started_at=now,
                            ended_at=None,
                        )
                    )
                    session.execute(
                        update(loans_table)
                        .where(loans_table.c.id == loan_id)
                        .values(
                            status=LoanStatus.ACTIVE.value,
                            approval_status=TradeApprovalStatus.APPROVED.value,
                            approved_by_manager_id=actor_manager_id,
                            approved_at=now,
                            start_gameweek=start_gameweek,
                            due_gameweek=due_gameweek,
                            duration_gameweeks=effective_duration,
                            updated_at=now,
                        )
                    )
                    self._event(
                        session,
                        loan_id,
                        "loan_started",
                        actor_manager_id,
                        now,
                        note,
                        {"start_gameweek": start_gameweek, "due_gameweek": due_gameweek},
                    )
                    self._repair_teams(session, affected_teams, now)
        return self.get(loan_id)

    def list_pending_approvals(self) -> list[LoanAgreementResponse]:
        with self._session_factory() as session:
            actor_manager_id = self._manager_for_user(session, self.user_id)
            if actor_manager_id is None:
                return []
            candidates = list(
                session.execute(
                    self._loan_query().where(
                        loans_table.c.status == LoanStatus.AGREED.value,
                        loans_table.c.approval_status == TradeApprovalStatus.PENDING.value,
                    )
                ).mappings()
            )
            visible = []
            for row in candidates:
                if actor_manager_id in {row["lender_manager_id"], row["borrower_manager_id"]}:
                    continue
                role = row["required_approver_role"]
                member = session.execute(
                    select(league_memberships_table.c.id)
                    .select_from(
                        league_memberships_table.join(
                            draft_teams_table,
                            draft_teams_table.c.league_id == league_memberships_table.c.league_id,
                        )
                    )
                    .where(
                        draft_teams_table.c.id == row["lender_team_id"],
                        league_memberships_table.c.manager_id == actor_manager_id,
                        league_memberships_table.c.role == role,
                    )
                ).scalar_one_or_none()
                if member is not None:
                    visible.append(self._response(row))
        return visible

    def events(self, loan_id: str) -> list[LoanEventResponse] | None:
        with self._session_factory() as session:
            loan = (
                session.execute(
                    select(loans_table.c.lender_team_id, loans_table.c.borrower_team_id).where(
                        loans_table.c.id == loan_id,
                        loans_table.c.season_id == self.season_id,
                    )
                )
                .mappings()
                .first()
            )
            if loan is None:
                return None
            actor_manager_id = self._manager_for_user(session, self.user_id)
            if actor_manager_id is None:
                return None
            participants = set(
                session.execute(
                    select(draft_teams_table.c.manager_id).where(
                        draft_teams_table.c.id.in_(
                            [loan["lender_team_id"], loan["borrower_team_id"]]
                        )
                    )
                ).scalars()
            )
            if actor_manager_id not in participants:
                return None
            rows = list(
                session.execute(
                    select(loan_events_table)
                    .where(loan_events_table.c.loan_id == loan_id)
                    .order_by(loan_events_table.c.created_at, loan_events_table.c.id)
                ).mappings()
            )
        return [
            LoanEventResponse(
                id=str(row["id"]),
                loan_id=str(row["loan_id"]),
                action=str(row["action"]),
                actor_manager_id=row["actor_manager_id"],
                created_at=row["created_at"],
                metadata=dict(row["metadata_json"] or {}),
            )
            for row in rows
        ]

    def process_due_returns(self) -> int:
        now = datetime.now(UTC)
        affected_teams: set[str] = set()
        returned = 0
        with self._session_factory() as session:
            with session.begin():
                season = session.execute(
                    select(seasons_table.c.id)
                    .where(seasons_table.c.id == self.season_id)
                    .with_for_update()
                ).scalar_one_or_none()
                if season is None:
                    return 0
                next_gameweek = next_upcoming_gameweek_number(session)
                candidates = list(
                    session.execute(
                        select(loans_table)
                        .where(
                            loans_table.c.season_id == self.season_id,
                            loans_table.c.status == LoanStatus.ACTIVE.value,
                        )
                        .order_by(loans_table.c.due_gameweek, loans_table.c.id)
                        .with_for_update()
                    ).mappings()
                )
                for loan in candidates:
                    due_gameweek = int(loan["due_gameweek"])
                    is_due = next_gameweek is not None and next_gameweek > due_gameweek
                    if next_gameweek is None:
                        event_finished = session.execute(
                            select(fpl_gameweeks_table.c.finished).where(
                                fpl_gameweeks_table.c.id == str(due_gameweek)
                            )
                        ).scalar_one_or_none()
                        is_due = bool(event_finished)
                    if not is_due:
                        continue
                    lender = str(loan["lender_team_id"])
                    borrower = str(loan["borrower_team_id"])
                    affected_teams.update([lender, borrower])
                    session.execute(
                        select(draft_teams_table.c.id)
                        .where(draft_teams_table.c.id.in_(sorted([lender, borrower])))
                        .order_by(draft_teams_table.c.id)
                        .with_for_update()
                    ).all()
                    ownership = (
                        session.execute(
                            select(squad_ownerships_table)
                            .where(
                                squad_ownerships_table.c.season_id == self.season_id,
                                squad_ownerships_table.c.draft_team_id == borrower,
                                squad_ownerships_table.c.player_id == loan["player_id"],
                                squad_ownerships_table.c.ended_at.is_(None),
                            )
                            .with_for_update()
                        )
                        .mappings()
                        .first()
                    )
                    if ownership is None:
                        raise ValueError("An active loan has no borrower ownership to return.")
                    position_id = session.execute(
                        select(fpl_players_table.c.position_id).where(
                            fpl_players_table.c.id == loan["player_id"]
                        )
                    ).scalar_one()
                    return_slot = self._return_slot(
                        session,
                        lender,
                        loan["lender_roster_slot_id"],
                        position_id,
                    )
                    session.execute(
                        update(squad_ownerships_table)
                        .where(squad_ownerships_table.c.id == ownership["id"])
                        .values(ended_at=now)
                    )
                    session.execute(
                        insert(squad_ownerships_table).values(
                            id=f"ownership-return-{uuid4().hex[:12]}",
                            season_id=self.season_id,
                            draft_team_id=lender,
                            player_id=loan["player_id"],
                            roster_slot_id=return_slot,
                            started_at=now,
                            ended_at=None,
                        )
                    )
                    session.execute(
                        update(loans_table)
                        .where(
                            loans_table.c.id == loan["id"],
                            loans_table.c.status == LoanStatus.ACTIVE.value,
                        )
                        .values(
                            status=LoanStatus.RETURNED.value,
                            returned_at=now,
                            updated_at=now,
                        )
                    )
                    self._event(session, str(loan["id"]), "loan_returned", None, now)
                    returned += 1
                if affected_teams:
                    self._repair_teams(session, affected_teams, now)
        return returned

    def _loan_query(self) -> Select:
        return (
            select(
                loans_table,
                fpl_players_table.c.web_name.label("player_name"),
                draft_teams_table.c.name.label("lender_team_name"),
                borrower_teams_table.c.name.label("borrower_team_name"),
                draft_teams_table.c.manager_id.label("lender_manager_id"),
                borrower_teams_table.c.manager_id.label("borrower_manager_id"),
            )
            .join(fpl_players_table, fpl_players_table.c.id == loans_table.c.player_id)
            .join(draft_teams_table, draft_teams_table.c.id == loans_table.c.lender_team_id)
            .join(
                borrower_teams_table,
                borrower_teams_table.c.id == loans_table.c.borrower_team_id,
            )
        )

    def _loan_row(self, session: Session, loan_id: str) -> RowMapping | None:
        return (
            session.execute(
                self._loan_query().where(
                    loans_table.c.id == loan_id,
                    loans_table.c.season_id == self.season_id,
                )
            )
            .mappings()
            .first()
        )

    @staticmethod
    def _response(row: object) -> LoanAgreementResponse:
        return LoanAgreementResponse(
            id=str(row["id"]),
            season_id=str(row["season_id"]),
            player_id=str(row["player_id"]),
            player_name=str(row["player_name"]),
            lender_team_id=str(row["lender_team_id"]),
            lender_team_name=str(row["lender_team_name"]),
            borrower_team_id=str(row["borrower_team_id"]),
            borrower_team_name=str(row["borrower_team_name"]),
            status=LoanStatus(row["status"]),
            approval_status=TradeApprovalStatus(row["approval_status"]),
            required_approver_role=str(row["required_approver_role"]),
            duration_gameweeks=int(row["duration_gameweeks"]),
            start_gameweek=row["start_gameweek"],
            due_gameweek=row["due_gameweek"],
            approved_by_manager_id=row["approved_by_manager_id"],
            approved_at=row["approved_at"],
            returned_at=row["returned_at"],
            created_at=row["created_at"],
        )

    @staticmethod
    def _manager_for_user(session: Session, user_id: str) -> str | None:
        return session.execute(
            select(managers_table.c.id)
            .where(or_(managers_table.c.user_id == user_id, managers_table.c.id == user_id))
            .limit(1)
        ).scalar_one_or_none()

    @staticmethod
    def _team_active_count(session: Session, team_id: str) -> int:
        return int(
            session.execute(
                select(func.count())
                .select_from(squad_ownerships_table)
                .where(
                    squad_ownerships_table.c.season_id == SEASON_ID,
                    squad_ownerships_table.c.draft_team_id == team_id,
                    squad_ownerships_table.c.ended_at.is_(None),
                )
            ).scalar_one()
        )

    @staticmethod
    def _active_lender_loan_count(session: Session, team_id: str) -> int:
        return int(
            session.execute(
                select(func.count())
                .select_from(loans_table)
                .where(
                    loans_table.c.season_id == SEASON_ID,
                    loans_table.c.lender_team_id == team_id,
                    loans_table.c.status == LoanStatus.ACTIVE.value,
                )
            ).scalar_one()
        )

    @staticmethod
    def _team_position_count(session: Session, team_id: str, position_name: str) -> int:
        owned_count = int(
            session.execute(
                select(func.count())
                .select_from(
                    squad_ownerships_table.join(
                        fpl_players_table,
                        fpl_players_table.c.id == squad_ownerships_table.c.player_id,
                    ).join(
                        fpl_positions_table,
                        fpl_positions_table.c.id == fpl_players_table.c.position_id,
                    )
                )
                .where(
                    squad_ownerships_table.c.season_id == SEASON_ID,
                    squad_ownerships_table.c.draft_team_id == team_id,
                    squad_ownerships_table.c.ended_at.is_(None),
                    fpl_positions_table.c.singular_name == position_name,
                )
            ).scalar_one()
        )
        loaned_out_count = int(
            session.execute(
                select(func.count())
                .select_from(
                    loans_table.join(
                        fpl_players_table,
                        fpl_players_table.c.id == loans_table.c.player_id,
                    ).join(
                        fpl_positions_table,
                        fpl_positions_table.c.id == fpl_players_table.c.position_id,
                    )
                )
                .where(
                    loans_table.c.season_id == SEASON_ID,
                    loans_table.c.lender_team_id == team_id,
                    loans_table.c.status == LoanStatus.ACTIVE.value,
                    fpl_positions_table.c.singular_name == position_name,
                )
            ).scalar_one()
        )
        return owned_count + loaned_out_count

    def _available_slot(self, session: Session, team_id: str, position_id: str) -> str:
        slot = session.execute(
            select(squad_roster_slots_table.c.id)
            .select_from(
                squad_roster_slots_table.outerjoin(
                    squad_ownerships_table,
                    and_(
                        squad_ownerships_table.c.roster_slot_id == squad_roster_slots_table.c.id,
                        squad_ownerships_table.c.season_id == self.season_id,
                        squad_ownerships_table.c.ended_at.is_(None),
                    ),
                )
            )
            .where(
                squad_roster_slots_table.c.season_id == self.season_id,
                squad_roster_slots_table.c.draft_team_id == team_id,
                or_(
                    squad_roster_slots_table.c.position_id == position_id,
                    squad_roster_slots_table.c.position_id.is_(None),
                ),
                squad_ownerships_table.c.id.is_(None),
            )
            .order_by(squad_roster_slots_table.c.sort_order)
            .limit(1)
            .with_for_update(of=squad_roster_slots_table)
        ).scalar_one_or_none()
        if slot is None:
            raise ValueError("The borrower has no compatible roster slot for the loan player.")
        return str(slot)

    def _return_slot(
        self, session: Session, team_id: str, original_slot_id: str | None, position_id: str
    ) -> str | None:
        if original_slot_id is not None:
            original_available = session.execute(
                select(squad_roster_slots_table.c.id)
                .select_from(
                    squad_roster_slots_table.outerjoin(
                        squad_ownerships_table,
                        and_(
                            squad_ownerships_table.c.roster_slot_id
                            == squad_roster_slots_table.c.id,
                            squad_ownerships_table.c.season_id == self.season_id,
                            squad_ownerships_table.c.ended_at.is_(None),
                        ),
                    )
                )
                .where(
                    squad_roster_slots_table.c.id == original_slot_id,
                    squad_roster_slots_table.c.draft_team_id == team_id,
                    squad_ownerships_table.c.id.is_(None),
                )
                .with_for_update(of=squad_roster_slots_table)
            ).scalar_one_or_none()
            if original_available is not None:
                return str(original_available)
        slot = session.execute(
            select(squad_roster_slots_table.c.id)
            .select_from(
                squad_roster_slots_table.outerjoin(
                    squad_ownerships_table,
                    and_(
                        squad_ownerships_table.c.roster_slot_id == squad_roster_slots_table.c.id,
                        squad_ownerships_table.c.season_id == self.season_id,
                        squad_ownerships_table.c.ended_at.is_(None),
                    ),
                )
            )
            .where(
                squad_roster_slots_table.c.season_id == self.season_id,
                squad_roster_slots_table.c.draft_team_id == team_id,
                or_(
                    squad_roster_slots_table.c.position_id == position_id,
                    squad_roster_slots_table.c.position_id.is_(None),
                ),
                squad_ownerships_table.c.id.is_(None),
            )
            .order_by(squad_roster_slots_table.c.sort_order)
            .limit(1)
            .with_for_update(of=squad_roster_slots_table)
        ).scalar_one_or_none()
        return str(slot) if slot is not None else None

    def _repair_teams(self, session: Session, team_ids: set[str], now: datetime) -> None:
        from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository

        for team_id in sorted(team_ids):
            owned_ids = set(
                session.execute(
                    select(squad_ownerships_table.c.player_id).where(
                        squad_ownerships_table.c.season_id == self.season_id,
                        squad_ownerships_table.c.draft_team_id == team_id,
                        squad_ownerships_table.c.ended_at.is_(None),
                    )
                ).scalars()
            )
            PostgreSQLTeamSelectionRepository.repair_unlocked_lineups(
                session, team_id, owned_ids, now
            )

    @staticmethod
    def _event(
        session: Session,
        loan_id: str,
        action: str,
        manager_id: str | None,
        now: datetime,
        note: str | None = None,
        details: dict[str, object] | None = None,
    ) -> None:
        metadata = dict(details or {})
        if note:
            metadata["note"] = note
        session.execute(
            insert(loan_events_table).values(
                id=f"loan-event-{uuid4().hex[:12]}",
                loan_id=loan_id,
                actor_manager_id=manager_id,
                action=action,
                created_at=now,
                metadata_json=metadata,
            )
        )
