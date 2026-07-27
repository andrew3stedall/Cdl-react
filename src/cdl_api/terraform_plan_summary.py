from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

type JsonValue = None | bool | int | float | str | list[JsonValue] | dict[str, JsonValue]

PUBLIC_PRINCIPALS = {"allUsers", "allAuthenticatedUsers"}
COST_SENSITIVE_TYPES = {
    "google_artifact_registry_repository": "Artifact Registry storage and network egress",
    "google_cloud_run_v2_service": (
        "Cloud Run CPU, memory, requests, and network egress when enabled"
    ),
    "google_monitoring_alert_policy": "Cloud Monitoring and underlying metric or log usage",
    "google_sql_database_instance": "Cloud SQL compute, SSD storage, backups, and transaction logs",
    "google_storage_bucket": "Cloud Storage capacity, operations, versioning, and network egress",
}
SECURITY_SENSITIVE_PREFIXES = (
    "google_project_iam_",
    "google_secret_manager_",
    "google_service_account",
    "google_storage_bucket",
    "google_cloud_run_v2_service",
    "google_sql_database_instance",
)


def _as_object(value: JsonValue) -> dict[str, JsonValue]:
    return value if isinstance(value, dict) else {}


def _as_list(value: JsonValue) -> list[JsonValue]:
    return value if isinstance(value, list) else []


def _as_string(value: JsonValue, default: str = "unknown") -> str:
    return value if isinstance(value, str) else default


def _contains_public_principal(value: JsonValue) -> bool:
    if isinstance(value, str):
        return value in PUBLIC_PRINCIPALS
    if isinstance(value, list):
        return any(_contains_public_principal(item) for item in value)
    if isinstance(value, dict):
        return any(_contains_public_principal(item) for item in value.values())
    return False


def _classify_actions(actions: list[str]) -> str:
    action_set = set(actions)
    if action_set == {"create"}:
        return "create"
    if action_set == {"update"}:
        return "update"
    if action_set == {"delete"}:
        return "delete"
    if action_set == {"create", "delete"}:
        return "replace"
    if action_set == {"read"}:
        return "read"
    if action_set == {"no-op"}:
        return "no-op"
    return "+".join(actions) if actions else "unknown"


def _parse_changes(plan: dict[str, JsonValue]) -> list[dict[str, JsonValue]]:
    parsed: list[dict[str, JsonValue]] = []
    for raw_change in _as_list(plan.get("resource_changes")):
        change = _as_object(raw_change)
        change_body = _as_object(change.get("change"))
        actions = [
            action
            for action in (
                _as_string(item, "") for item in _as_list(change_body.get("actions"))
            )
            if action
        ]
        action = _classify_actions(actions)
        parsed.append(
            {
                "address": _as_string(change.get("address")),
                "type": _as_string(change.get("type")),
                "action": action,
                "destructive": action in {"delete", "replace"},
                "public": _contains_public_principal(change_body.get("after")),
            }
        )
    return parsed


def _markdown_table(rows: list[tuple[str, str, str]]) -> list[str]:
    if not rows:
        return ["No managed resource changes are proposed."]
    lines = ["| Action | Resource type | Address |", "| --- | --- | --- |"]
    lines.extend(
        f"| `{action}` | `{resource_type}` | `{address}` |"
        for action, resource_type, address in rows
    )
    return lines


def summarize_plan(
    plan: dict[str, JsonValue],
    *,
    plan_sha256: str,
    plan_exit_code: int,
    source_sha: str,
    run_url: str,
) -> tuple[str, int]:
    changes = _parse_changes(plan)
    changed = [item for item in changes if item["action"] not in {"no-op", "read"}]
    action_counts = Counter(_as_string(item["action"]) for item in changed)
    destructive = [item for item in changed if item["destructive"] is True]
    public = [item for item in changed if item["public"] is True]

    cost_types = sorted(
        {
            resource_type
            for item in changed
            if (resource_type := _as_string(item["type"])) in COST_SENSITIVE_TYPES
        }
    )
    security_types = sorted(
        {
            resource_type
            for item in changed
            if (resource_type := _as_string(item["type"])).startswith(
                SECURITY_SENSITIVE_PREFIXES
            )
        }
    )

    gate_status = "PASS"
    exit_code = 0
    if destructive:
        gate_status = "BLOCKED: destructive delete or replacement action detected"
        exit_code = 2
    if public:
        gate_status = "BLOCKED: public IAM principal detected"
        exit_code = 3

    generated_at = datetime.now(UTC).isoformat(timespec="seconds")
    lines = [
        "# Staging Terraform plan review",
        "",
        f"- Safety gate: **{gate_status}**",
        f"- Source commit: `{source_sha}`",
        f"- Workflow run: {run_url or 'not available'}",
        f"- Generated: `{generated_at}`",
        f"- Terraform version: `{_as_string(plan.get('terraform_version'))}`",
        f"- Plan format version: `{_as_string(plan.get('format_version'))}`",
        f"- Saved plan SHA-256: `{plan_sha256}`",
        f"- Terraform detailed exit code: `{plan_exit_code}`",
        "- Binary plan and machine-readable JSON: not retained or uploaded",
        "",
        "## Change counts",
        "",
    ]

    if action_counts:
        lines.extend(
            f"- `{action}`: {count}" for action, count in sorted(action_counts.items())
        )
    else:
        lines.append("- No managed resource changes")

    lines.extend(["", "## Proposed managed-resource changes", ""])
    rows = [
        (_as_string(item["action"]), _as_string(item["type"]), _as_string(item["address"]))
        for item in changed
    ]
    lines.extend(_markdown_table(rows))

    lines.extend(["", "## Cost-sensitive resource categories", ""])
    if cost_types:
        lines.extend(
            f"- `{resource_type}` — {COST_SENSITIVE_TYPES[resource_type]}"
            for resource_type in cost_types
        )
    else:
        lines.append("- None in this plan")

    lines.extend(["", "## Security-sensitive resource categories", ""])
    if security_types:
        lines.extend(f"- `{resource_type}`" for resource_type in security_types)
    else:
        lines.append("- None in this plan")

    lines.extend(
        [
            "",
            "## Review boundary",
            "",
            "This summary intentionally omits resource values. Review the human-readable "
            "plan artifact before approval.",
            "A fresh plan is required for any future apply; this workflow never applies "
            "infrastructure.",
        ]
    )

    return "\n".join(lines) + "\n", exit_code


def _load_plan(path: Path) -> dict[str, JsonValue]:
    loaded: JsonValue = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(loaded, dict):
        raise ValueError("Terraform plan JSON must be an object.")
    return loaded


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a redacted Terraform plan review summary."
    )
    parser.add_argument("--plan-json", type=Path, required=True)
    parser.add_argument("--plan-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--plan-exit-code", type=int, required=True)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    plan_sha256 = hashlib.sha256(args.plan_file.read_bytes()).hexdigest()
    run_url = ""
    if server_url := os.environ.get("GITHUB_SERVER_URL"):
        repository = os.environ.get("GITHUB_REPOSITORY", "")
        run_id = os.environ.get("GITHUB_RUN_ID", "")
        if repository and run_id:
            run_url = f"{server_url}/{repository}/actions/runs/{run_id}"

    markdown, exit_code = summarize_plan(
        _load_plan(args.plan_json),
        plan_sha256=plan_sha256,
        plan_exit_code=args.plan_exit_code,
        source_sha=os.environ.get("GITHUB_SHA", "unknown"),
        run_url=run_url,
    )
    args.output.write_text(markdown, encoding="utf-8")
    if summary_path := os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(summary_path).open("a", encoding="utf-8") as summary_file:
            summary_file.write(markdown)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
