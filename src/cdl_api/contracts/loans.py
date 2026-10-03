"""Persistent loan agreement and lifecycle contracts."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from cdl_api.contracts.squad import TradeApprovalDecision, TradeApprovalStatus


class LoanStatus(StrEnum):
    PROPOSED = "proposed"
    AGREED = "agreed"
    ACTIVE = "active"
    RETURNED = "returned"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class LoanCreateRequest(BaseModel):
    player_id: str
    borrower_team_id: str
    duration_gameweeks: int = Field(default=4, ge=4)


class LoanPartyDecisionRequest(BaseModel):
    status: LoanStatus


class LoanApprovalRequest(BaseModel):
    decision: TradeApprovalDecision
    note: str | None = Field(default=None, max_length=512)


class LoanAgreementResponse(BaseModel):
    id: str
    season_id: str
    player_id: str
    player_name: str
    lender_team_id: str
    lender_team_name: str
    borrower_team_id: str
    borrower_team_name: str
    status: LoanStatus
    approval_status: TradeApprovalStatus
    required_approver_role: str
    duration_gameweeks: int
    start_gameweek: int | None = None
    due_gameweek: int | None = None
    approved_by_manager_id: str | None = None
    approved_at: datetime | None = None
    returned_at: datetime | None = None
    created_at: datetime


class LoanAgreementsResponse(BaseModel):
    loans: list[LoanAgreementResponse]


class LoanResponse(BaseModel):
    loan: LoanAgreementResponse


class LoanEventResponse(BaseModel):
    id: str
    loan_id: str
    action: str
    actor_manager_id: str | None = None
    created_at: datetime
    metadata: dict[str, object] = Field(default_factory=dict)


class LoanEventsResponse(BaseModel):
    events: list[LoanEventResponse]
