"""Application service for persistent loan workflows."""

from cdl_api.contracts.loans import (
    LoanAgreementResponse,
    LoanCreateRequest,
    LoanEventResponse,
    LoanStatus,
)
from cdl_api.contracts.squad import TradeApprovalDecision
from cdl_api.repositories.loans import PostgreSQLLoanRepository


class LoanService:
    def __init__(self, repository: PostgreSQLLoanRepository) -> None:
        self._repository = repository

    def list_for_manager(self) -> list[LoanAgreementResponse]:
        return self._repository.list_for_manager()

    def create(self, request: LoanCreateRequest) -> LoanAgreementResponse:
        return self._repository.create(request)

    def decide(self, loan_id: str, status: LoanStatus) -> LoanAgreementResponse | None:
        return self._repository.update_party_status(loan_id, status)

    def approve(
        self, loan_id: str, decision: TradeApprovalDecision, note: str | None
    ) -> LoanAgreementResponse | None:
        return self._repository.approve(loan_id, decision, note)

    def list_pending_approvals(self) -> list[LoanAgreementResponse]:
        return self._repository.list_pending_approvals()

    def events(self, loan_id: str) -> list[LoanEventResponse] | None:
        return self._repository.events(loan_id)
