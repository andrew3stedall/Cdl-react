"""Execution grant, exact-action approval, and bounded AI activity policy."""

import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from cdl_api.repositories.ai_execution import (
    InMemoryAIExecutionRepository,
    PostgreSQLAIExecutionRepository,
)

GRANT_SECONDS = 60 * 60
APPROVAL_SECONDS = 10 * 60
AUDIT_RETENTION_DAYS = 90
_SENSITIVE_KEY_PARTS = ("token", "secret", "password", "email", "note", "description")


def _canonical_digest(tool_name: str, arguments: dict[str, Any]) -> str:
    value = json.dumps(
        {"tool": tool_name, "arguments": arguments}, sort_keys=True, separators=(",", ":")
    )
    return hashlib.sha256(value.encode()).hexdigest()


def redact_arguments(arguments: dict[str, Any]) -> dict[str, Any]:
    """Retain useful audit context while redacting free text and credential-like fields."""

    def redact(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: "[redacted]"
                if any(part in key.lower() for part in _SENSITIVE_KEY_PARTS)
                else redact(item)
                for key, item in value.items()
            }
        if isinstance(value, list):
            return [redact(item) for item in value]
        return value

    return redact(arguments)


class AIExecutionPolicy:
    def __init__(
        self,
        repository: InMemoryAIExecutionRepository | PostgreSQLAIExecutionRepository,
    ) -> None:
        self._repository = repository

    def activate(self, user_id: str, connection_id: str) -> dict[str, Any]:
        now = datetime.now(UTC)
        self._repository.revoke_grants(user_id, connection_id, now)
        expires_at = now + timedelta(seconds=GRANT_SECONDS)
        grant_id = self._repository.activate(user_id, connection_id, now, expires_at)
        return {
            "id": grant_id,
            "connection_id": connection_id,
            "activated_at": now,
            "expires_at": expires_at,
        }

    def active_grant(self, user_id: str, connection_id: str) -> dict[str, Any] | None:
        return self._repository.active_grant(user_id, connection_id, datetime.now(UTC))

    def revoke(self, user_id: str, connection_id: str) -> int:
        return self._repository.revoke_grants(user_id, connection_id, datetime.now(UTC))

    def prepare_consequential(
        self,
        *,
        user_id: str,
        connection_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        idempotency_key: str,
        state_version: str,
        approval_base_url: str,
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        if not self.active_grant(user_id, connection_id):
            return {
                "status": "execution_grant_required",
                "message": (
                    "Manually activate a 60-minute execution window in CDL Profile "
                    "before this action."
                ),
            }
        digest = _canonical_digest(tool_name, arguments)
        existing = self._repository.find_proposal(
            user_id, connection_id, tool_name, idempotency_key
        )
        if existing:
            if existing["action_digest"] != digest:
                return {
                    "status": "idempotency_conflict",
                    "message": (
                        "This idempotency key is already bound to different action parameters."
                    ),
                }
            if existing["status"] == "completed":
                return {"status": "completed", "result": existing.get("result")}
            if existing["status"] == "failed":
                return {"status": "execution_failed", "result": existing.get("result")}
            if existing["status"] == "consumed":
                return {
                    "status": "in_progress",
                    "message": "This exact action is already being processed.",
                }
            if existing["state_version"] != state_version:
                self._repository.update_proposal(existing["id"], status="stale")
                return {
                    "status": "state_changed",
                    "message": (
                        "The underlying CDL state changed after approval. "
                        "Request a fresh exact-action approval."
                    ),
                }
            if existing["status"] == "approved":
                if existing["expires_at"] <= now:
                    self._repository.update_proposal(existing["id"], status="expired")
                    return {
                        "status": "approval_expired",
                        "message": "Request a new action with a new idempotency key.",
                    }
                consumed = self._repository.consume_proposal(existing["id"], digest, now)
                if consumed:
                    return {"status": "approved", "proposal_id": existing["id"]}
                return {"status": "approval_required", "proposal_id": existing["id"]}
            if existing["status"] == "pending" and existing["expires_at"] > now:
                return {
                    "status": "approval_required",
                    "proposal_id": existing["id"],
                    "approval_url": (
                        f"{approval_base_url.rstrip('/')}/ai-approvals/{existing['id']}"
                    ),
                }
            if existing["status"] == "pending":
                self._repository.update_proposal(existing["id"], status="expired")
                return {
                    "status": "approval_expired",
                    "message": "Request a new action with a new idempotency key.",
                }
            if existing["status"] in {"rejected", "stale", "expired"}:
                return {
                    "status": existing["status"],
                    "message": "Start a new action with a fresh idempotency key.",
                }
        proposal_id = uuid4().hex
        created = self._repository.create_proposal(
            {
                "id": proposal_id,
                "user_id": user_id,
                "connection_id": connection_id,
                "tool_name": tool_name,
                "arguments": arguments,
                "action_digest": digest,
                "state_version": state_version,
                "idempotency_key": idempotency_key,
                "created_at": now,
                "expires_at": now + timedelta(seconds=APPROVAL_SECONDS),
                "approved_at": None,
                "rejected_at": None,
                "consumed_at": None,
                "status": "pending",
                "result": None,
            }
        )
        if created["action_digest"] != digest:
            return {
                "status": "idempotency_conflict",
                "message": "This idempotency key is already bound to different action parameters.",
            }
        if created["state_version"] != state_version:
            self._repository.update_proposal(created["id"], status="stale")
            return {
                "status": "state_changed",
                "message": "The underlying CDL state changed while this action was being prepared.",
            }
        return {
            "status": "approval_required",
            "proposal_id": created["id"],
            "approval_url": f"{approval_base_url.rstrip('/')}/ai-approvals/{created['id']}",
        }

    def get_proposal(self, proposal_id: str, user_id: str) -> dict[str, Any] | None:
        row = self._repository.get_proposal(proposal_id)
        if not row or row["user_id"] != user_id:
            return None
        return row

    def approve(self, proposal_id: str, user_id: str) -> bool:
        return self._repository.approve_proposal(proposal_id, user_id, datetime.now(UTC))

    def reject(self, proposal_id: str, user_id: str) -> bool:
        return self._repository.reject_proposal(proposal_id, user_id, datetime.now(UTC))

    def finish_proposal(self, proposal_id: str, result: Any, *, status: str = "completed") -> None:
        self._repository.update_proposal(proposal_id, status=status, result=result)

    def record_activity(
        self,
        *,
        user_id: str,
        connection_id: str,
        tool_name: str,
        risk: str,
        outcome: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        row = {
            "id": uuid4().hex,
            "user_id": user_id,
            "connection_id": connection_id,
            "tool_name": tool_name,
            "risk": risk,
            "outcome": outcome,
            "details": redact_arguments(arguments),
            "created_at": now,
            "retention_until": now + timedelta(days=AUDIT_RETENTION_DAYS),
        }
        self._repository.append_activity(row)
        return row

    def activity(self, user_id: str, limit: int = 100) -> list[dict[str, Any]]:
        return self._repository.list_activity(user_id, datetime.now(UTC), max(1, min(limit, 100)))
