"""Shared API contract models."""

from enum import StrEnum

from pydantic import BaseModel, Field


class ErrorCode(StrEnum):
    VALIDATION_ERROR = "validation_error"
    UNAUTHENTICATED = "unauthenticated"
    FORBIDDEN = "forbidden"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    SERVER_ERROR = "server_error"


class ApiErrorResponse(BaseModel):
    code: ErrorCode
    message: str
    details: dict[str, object] = Field(default_factory=dict)


class ValidationIssue(BaseModel):
    field: str
    message: str
    rule_reference: str | None = None


class ValidationErrorResponse(BaseModel):
    code: ErrorCode = ErrorCode.VALIDATION_ERROR
    message: str
    issues: list[ValidationIssue] = Field(default_factory=list)


class RuleReference(BaseModel):
    rule_id: str
    label: str
    href: str
