"""Derive honest per-connection AI verification state from OAuth and audit records."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from cdl_api.contracts.ai_connections import (
    AIConnectionDiagnosticsResponse,
    AIConnectionFailure,
    AIConnectionFailureCategory,
    AIConnectionState,
    AIConnectionStatusResponse,
    AIMCPEndpointStatus,
)
from cdl_api.services.ai_execution import AIExecutionPolicy

REVOKED_VISIBILITY_DAYS = 14
CHECK_TOOL_NAME = "connection.check"
CHECK_RISK = "diagnostic"

_FAILURE_CATEGORIES = {
    "permission_denied": AIConnectionFailureCategory.PERMISSION,
    "invalid_request": AIConnectionFailureCategory.REQUEST,
    "error": AIConnectionFailureCategory.SERVICE,
    "preflight_error": AIConnectionFailureCategory.SERVICE,
}


class ConnectionRecordSource(Protocol):
    def list_connection_records(
        self, user_id: str, revoked_since: datetime
    ) -> list[dict[str, Any]]: ...


class ReadEvidenceSource(Protocol):
    def read_evidence(
        self, user_id: str, connection_ids: list[str], now: datetime
    ) -> dict[str, dict[str, Any]]: ...


class AIConnectionNotFoundError(LookupError):
    """The connection does not exist for this user or is no longer visible."""


class AIConnectionDiagnosticsService:
    """Report OAuth authorization separately from observed end-to-end MCP reads.

    Consent, browser API reachability and wizard completion are never treated as
    verification. A connection is ``verified`` only when the audit log holds a
    successful read-risk tool call recorded against that OAuth connection ID.
    """

    def __init__(
        self,
        connections: ConnectionRecordSource,
        evidence: ReadEvidenceSource,
        policy: AIExecutionPolicy,
        endpoint: AIMCPEndpointStatus,
        team_lookup: Callable[[str], bool | None],
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._connections = connections
        self._evidence = evidence
        self._policy = policy
        self._endpoint = endpoint
        self._team_lookup = team_lookup
        self._clock = clock

    def diagnostics(self, user_id: str) -> AIConnectionDiagnosticsResponse:
        now = self._clock()
        return AIConnectionDiagnosticsResponse(
            checked_at=now,
            endpoint=self._endpoint,
            team_assigned=self._team_assigned(user_id),
            connections=self._statuses(user_id, now),
        )

    def check(self, user_id: str, connection_id: str) -> AIConnectionStatusResponse:
        """Re-derive one owned connection's state and audit the manual check."""
        now = self._clock()
        status = next(
            (row for row in self._statuses(user_id, now) if row.id == connection_id), None
        )
        if status is None:
            raise AIConnectionNotFoundError(connection_id)
        self._policy.record_activity(
            user_id=user_id,
            connection_id=connection_id,
            tool_name=CHECK_TOOL_NAME,
            risk=CHECK_RISK,
            outcome=status.state.value,
            arguments={"connection_id": connection_id},
        )
        return status

    def _team_assigned(self, user_id: str) -> bool | None:
        try:
            return self._team_lookup(user_id)
        except Exception:  # noqa: BLE001 - diagnostics must degrade, not fail the page
            return None

    def _statuses(self, user_id: str, now: datetime) -> list[AIConnectionStatusResponse]:
        records = self._connections.list_connection_records(
            user_id, now - timedelta(days=REVOKED_VISIBILITY_DAYS)
        )
        evidence = self._evidence.read_evidence(user_id, [str(row["id"]) for row in records], now)
        statuses = [self._status(row, evidence.get(str(row["id"])), now) for row in records]
        return sorted(statuses, key=lambda row: row.created_at, reverse=True)

    @staticmethod
    def _status(
        row: dict[str, Any], evidence: dict[str, Any] | None, now: datetime
    ) -> AIConnectionStatusResponse:
        evidence = evidence or {}
        last_success = evidence.get("last_success_at")
        last_failure_at = evidence.get("last_failure_at")
        failure = (
            AIConnectionFailure(
                category=_FAILURE_CATEGORIES.get(
                    str(evidence.get("last_failure_outcome")), AIConnectionFailureCategory.OTHER
                ),
                observed_at=last_failure_at,
            )
            if last_failure_at is not None
            else None
        )
        access_expires_at = row.get("refresh_expires_at")
        if row.get("revoked_at") is not None:
            state = AIConnectionState.REVOKED
        elif access_expires_at is None or _aware(access_expires_at) <= now:
            state = AIConnectionState.EXPIRED
        elif failure is not None and (
            last_success is None or _aware(last_failure_at) > _aware(last_success)
        ):
            state = AIConnectionState.CHECK_FAILED
        elif last_success is not None:
            state = AIConnectionState.VERIFIED
        else:
            state = AIConnectionState.AUTHORIZED
        return AIConnectionStatusResponse(
            id=str(row["id"]),
            client_id=str(row["client_id"]),
            client_name=str(row["client_name"]),
            scopes=list(row["scopes"]),
            created_at=row["created_at"],
            last_used_at=row.get("last_used_at"),
            revoked_at=row.get("revoked_at"),
            access_expires_at=access_expires_at,
            state=state,
            first_verified_read_at=evidence.get("first_success_at"),
            last_verified_read_at=last_success,
            last_failure=failure,
        )


def _aware(value: datetime) -> datetime:
    """SQLite drops tzinfo in tests; PostgreSQL returns aware timestamps."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
