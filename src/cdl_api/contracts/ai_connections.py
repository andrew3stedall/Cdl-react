"""Owner-facing AI connection verification and diagnostics contracts."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class AIConnectionState(StrEnum):
    """Per-connection verification state.

    ``authorized`` means OAuth consent completed but no correlated remote MCP read
    has been observed. Only ``verified`` is backed by a successful read-tool call
    recorded against this exact OAuth connection.
    """

    AUTHORIZED = "authorized"
    VERIFIED = "verified"
    CHECK_FAILED = "check_failed"
    EXPIRED = "expired"
    REVOKED = "revoked"


class AIConnectionFailureCategory(StrEnum):
    PERMISSION = "permission"
    REQUEST = "request"
    SERVICE = "service"
    OTHER = "other"


class AIConnectionFailure(BaseModel):
    category: AIConnectionFailureCategory
    observed_at: datetime


class AIConnectionStatusResponse(BaseModel):
    id: str
    client_id: str
    client_name: str
    scopes: list[str]
    created_at: datetime
    last_used_at: datetime | None = None
    revoked_at: datetime | None = None
    access_expires_at: datetime | None = None
    state: AIConnectionState
    first_verified_read_at: datetime | None = None
    last_verified_read_at: datetime | None = None
    last_failure: AIConnectionFailure | None = None


class AIMCPEndpointStatus(BaseModel):
    url: str
    oauth_enabled: bool
    remote_enabled: bool
    browser_enabled: bool
    execution_enabled: bool


class AIConnectionDiagnosticsResponse(BaseModel):
    checked_at: datetime
    endpoint: AIMCPEndpointStatus
    team_assigned: bool | None
    connections: list[AIConnectionStatusResponse]
