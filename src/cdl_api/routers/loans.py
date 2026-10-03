"""Authenticated persistent loan agreement and approval routes."""

from fastapi import APIRouter, Depends, HTTPException, status

from cdl_api.contracts.loans import (
    LoanAgreementsResponse,
    LoanApprovalRequest,
    LoanCreateRequest,
    LoanEventsResponse,
    LoanPartyDecisionRequest,
    LoanResponse,
)
from cdl_api.contracts.session import SessionUser
from cdl_api.database import build_session_factory
from cdl_api.repositories.loans import PostgreSQLLoanRepository
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.squad import require_manager_session, require_trade_approval_session
from cdl_api.services.live_draft import LiveDraftError
from cdl_api.services.loans import LoanService
from cdl_api.settings import Settings, get_settings
from cdl_api.staging_draft_seed import UnassignedManagerContextError

router = APIRouter(prefix="/loans", tags=["loans"])


def get_loan_service(
    user: SessionUser = Depends(require_authenticated_session),
    settings: Settings = Depends(get_settings),
) -> LoanService:
    if settings.repository_mode != "postgres":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Persistent loans require PostgreSQL repository mode.",
        )
    session_factory = build_session_factory(settings)
    try:
        squad = PostgreSQLSquadRepository(session_factory, user_id=user.id)
    except UnassignedManagerContextError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated manager does not have an assigned team in this league.",
        ) from exc
    repository = PostgreSQLLoanRepository(
        session_factory,
        user_id=user.id,
        manager_id=squad._manager_id,
        team_id=squad.manager_team.id,
    )
    return LoanService(repository)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found.")


def _bad_request(exc: ValueError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.get("", response_model=LoanAgreementsResponse)
def list_loans(
    _: SessionUser = Depends(require_manager_session),
    service: LoanService = Depends(get_loan_service),
) -> LoanAgreementsResponse:
    return LoanAgreementsResponse(loans=service.list_for_manager())


@router.post("", response_model=LoanResponse)
def create_loan(
    payload: LoanCreateRequest,
    _: SessionUser = Depends(require_manager_session),
    service: LoanService = Depends(get_loan_service),
) -> LoanResponse:
    try:
        return LoanResponse(loan=service.create(payload))
    except ValueError as exc:
        raise _bad_request(exc) from exc


@router.get("/approvals", response_model=LoanAgreementsResponse)
def list_loan_approvals(
    _: SessionUser = Depends(require_trade_approval_session),
    service: LoanService = Depends(get_loan_service),
) -> LoanAgreementsResponse:
    return LoanAgreementsResponse(loans=service.list_pending_approvals())


@router.put("/{loan_id}", response_model=LoanResponse)
def decide_loan(
    loan_id: str,
    payload: LoanPartyDecisionRequest,
    _: SessionUser = Depends(require_manager_session),
    service: LoanService = Depends(get_loan_service),
) -> LoanResponse:
    try:
        loan = service.decide(loan_id, payload.status)
    except ValueError as exc:
        raise _bad_request(exc) from exc
    if loan is None:
        raise _not_found()
    return LoanResponse(loan=loan)


@router.post("/{loan_id}/approve", response_model=LoanResponse)
def approve_loan(
    loan_id: str,
    payload: LoanApprovalRequest,
    _: SessionUser = Depends(require_trade_approval_session),
    service: LoanService = Depends(get_loan_service),
) -> LoanResponse:
    try:
        loan = service.approve(loan_id, payload.decision, payload.note)
    except LiveDraftError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ValueError as exc:
        raise _bad_request(exc) from exc
    if loan is None:
        raise _not_found()
    return LoanResponse(loan=loan)


@router.get("/{loan_id}/events", response_model=LoanEventsResponse)
def loan_events(
    loan_id: str,
    _: SessionUser = Depends(require_manager_session),
    service: LoanService = Depends(get_loan_service),
) -> LoanEventsResponse:
    events = service.events(loan_id)
    if events is None:
        raise _not_found()
    return LoanEventsResponse(events=events)
