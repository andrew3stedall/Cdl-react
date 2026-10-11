"""Contracts for AI-assisted review workflows."""

from pydantic import BaseModel, Field

from cdl_api.contracts.loans import LoanAgreementResponse
from cdl_api.contracts.squad import TradeProposal


class PendingApprovalsResponse(BaseModel):
    """Pending trade and loan approvals visible to an eligible league approver."""

    trades: list[TradeProposal] = Field(default_factory=list)
    loans: list[LoanAgreementResponse] = Field(default_factory=list)
