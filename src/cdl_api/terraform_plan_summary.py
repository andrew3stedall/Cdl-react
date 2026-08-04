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
STAGING_PUBLIC_INVOKER_ADDRESS = (
    "module.cloud_run_api[0].google_cloud_run_v2_service_iam_member.public_invoker[0]"
)
APPROVED_STAGING_RESOURCE_TYPES = {
    "google_artifact_registry_repository",
    "google_cloud_run_v2_job",
    "google_cloud_run_v2_service",
    "google_cloud_run_v2_service_iam_member",
    "google_monitoring_alert_policy",
    "google_project_iam_member",
    "google_project_service",
    "google_secret_manager_secret",
    "google_secret_manager_secret_iam_member",
    "google_service_account",
    "google_sql_database",
    "google_sql_database_instance",
    "google_storage_bucket",
}
COST_SENSITIVE_TYPES = {
    "google_artifact_registry_repository": "Artifact Registry storage and network egress",
    "google_cloud_run_v2_job": "Cloud Run job CPU, memory, executions, and network egress",
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
    "google_cloud_run_v2_job",
    "google_cloud_run_v2_service",
    "google_sql_database_instance",
)


def _as_object(value: JsonValue) -> dict[str, JsonValue]:
    return value if isinstance(value, dict) else {}


def _as_list(value: JsonValue) -> list[JsonValue]:
    return value if isinstance(value, list) else []


def _as_string(value: JsonValue, default: str = "unknown") -> str:
    return value if isinstance(value, str) else default


def _public_principals(value: JsonValue) -> set[str]:
    if isinstance(value, str):
        return {value} if value in PUBLIC_PRINCIPALS else set()
    if isinstance(value, list):
        return set().union(*(_public_principals(item) for item in value))
    if isinstance(value, dict):
        return set().union(*(_public_principals(item) for item in value.values()))
    return set()


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


def _changed_paths(before: JsonValue, after: JsonValue, prefix: str = "") -> set[str]:
    """Return redacted structural paths whose values differ.

    Lists are treated as a single path because provider set ordering is not stable and
    individual indexes would create false overlap. Values are never retained or rendered.
    """
    if before == after:
        return set()

    if isinstance(before, dict) and isinstance(after, dict):
        paths: set[str] = set()
        for key in sorted(set(before) | set(after)):
            child_prefix = f"{prefix}.{key}" if prefix else key
            if key not in before or key not in after:
                paths.add(child_prefix)
            else:
                paths.update(_changed_paths(before[key], after[key], child_prefix))
        return paths or {prefix or "<root>"}

    if isinstance(before, list) and isinstance(after, list):
        return {prefix or "<root>"}

    return {prefix or "<root>"}


def _paths_overlap(left: str, right: str) -> bool:
    if "<root>" in {left, right}:
        return True
    return left == right or left.startswith(f"{right}.") or right.startswith(f"{left}.")


def _parse_changes(
    plan: dict[str, JsonValue], collection: str = "resource_changes"
) -> list[dict[str, JsonValue]]:
    parsed: list[dict[str, JsonValue]] = []
    for raw_change in _as_list(plan.get(collection)):
        change = _as_object(raw_change)
        change_body = _as_object(change.get("change"))
        actions = [
            action
            for action in (_as_string(item, "") for item in _as_list(change_body.get("actions")))
            if action
        ]
        action = _classify_actions(actions)
        before_value = change_body.get("before")
        after_value = change_body.get("after")
        after = _as_object(after_value)
        public_principals = _public_principals(after_value)
        parsed.append(
            {
                "address": _as_string(change.get("address")),
                "type": _as_string(change.get("type")),
                "action": action,
                "destructive": action in {"delete", "replace"},
                "public": bool(public_principals),
                "public_principals": sorted(public_principals),
                "member": _as_string(after.get("member"), ""),
                "role": _as_string(after.get("role"), ""),
                "changed_paths": sorted(_changed_paths(before_value, after_value)),
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


def _classify_drift(
    changed: list[dict[str, JsonValue]],
    drift: list[dict[str, JsonValue]],
) -> tuple[list[dict[str, JsonValue]], list[dict[str, JsonValue]]]:
    """Split drift into managed reconciliation and non-overlapping refresh differences.

    Terraform's ``resource_drift`` includes provider-computed state normalization. That is
    not actionable when the normal plan does not intend to change the same structural path.
    A same-resource create/delete/replace or any overlapping update path remains fail-closed.
    """
    managed_by_address = {
        _as_string(item["address"]): item
        for item in changed
        if item["action"] not in {"no-op", "read"}
    }
    actionable: list[dict[str, JsonValue]] = []
    refresh_only: list[dict[str, JsonValue]] = []

    for item in drift:
        managed = managed_by_address.get(_as_string(item["address"]))
        if managed is None:
            refresh_only.append(item)
            continue

        if managed["action"] in {"create", "delete", "replace"}:
            actionable.append(item)
            continue

        drift_paths = {
            path for path in item.get("changed_paths", []) if isinstance(path, str)
        }
        managed_paths = {
            path for path in managed.get("changed_paths", []) if isinstance(path, str)
        }
        if not drift_paths or not managed_paths:
            actionable.append(item)
            continue

        overlaps = any(
            _paths_overlap(drift_path, managed_path)
            for drift_path in drift_paths
            for managed_path in managed_paths
        )
        (actionable if overlaps else refresh_only).append(item)

    return actionable, refresh_only


def summarize_plan(
    plan: dict[str, JsonValue],
    *,
    plan_sha256: str,
    plan_exit_code: int,
    source_sha: str,
    run_url: str,
    allow_staging_public_invoker: bool = False,
) -> tuple[str, int]:
    changes = _parse_changes(plan)
    changed = [item for item in changes if item["action"] not in {"no-op", "read"}]
    drift = [
        item
        for item in _parse_changes(plan, "resource_drift")
        if item["action"] not in {"no-op", "read"}
    ]
    actionable_drift, refresh_only_drift = _classify_drift(changed, drift)
    if drift and plan_exit_code != 0 and not changed:
        # A non-zero detailed exit code without parsed managed changes is inconsistent.
        # Fail closed rather than treating the entire plan as provider-only refresh noise.
        actionable_drift = drift
        refresh_only_drift = []
    action_counts = Counter(_as_string(item["action"]) for item in changed)
    destructive = [item for item in changed if item["destructive"] is True]
    public = [item for item in changed if item["public"] is True]
    allowed_public_invoker = [
        item
        for item in public
        if allow_staging_public_invoker
        and item["address"] == STAGING_PUBLIC_INVOKER_ADDRESS
        and item["type"] == "google_cloud_run_v2_service_iam_member"
        and item["action"] == "create"
        and item["member"] == "allUsers"
        and item["role"] == "roles/run.invoker"
        and item["public_principals"] == ["allUsers"]
    ]
    blocked_public = [item for item in public if item not in allowed_public_invoker]
    unexpected_types = sorted(
        {
            resource_type
            for item in changed
            if (resource_type := _as_string(item["type"])) not in APPROVED_STAGING_RESOURCE_TYPES
        }
    )

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
            if (resource_type := _as_string(item["type"])).startswith(SECURITY_SENSITIVE_PREFIXES)
        }
    )

    gate_status = "PASS"
    exit_code = 0
    if blocked_public:
        gate_status = "BLOCKED: public IAM principal detected"
        exit_code = 3
    elif destructive:
        gate_status = "BLOCKED: destructive delete or replacement action detected"
        exit_code = 2
    elif unexpected_types:
        gate_status = "BLOCKED: unreviewed staging resource type detected"
        exit_code = 4
    elif actionable_drift and plan_exit_code != 0:
        gate_status = "BLOCKED: actionable out-of-band resource drift detected"
        exit_code = 5

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
        "- Public staging invoker: "
        + (
            "explicitly allowed for the application-login access model"
            if allow_staging_public_invoker
            else "disabled"
        ),
        "- Binary plan and machine-readable JSON: not retained or uploaded",
        "",
        "## Change counts",
        "",
    ]

    if action_counts:
        lines.extend(f"- `{action}`: {count}" for action, count in sorted(action_counts.items()))
    else:
        lines.append("- No managed resource changes")

    lines.extend(["", "## Proposed managed-resource changes", ""])
    rows = [
        (_as_string(item["action"]), _as_string(item["type"]), _as_string(item["address"]))
        for item in changed
    ]
    lines.extend(_markdown_table(rows))

    lines.extend(["", "## Detected remote-state drift", ""])
    if actionable_drift:
        lines.append("### Actionable managed reconciliation")
        lines.append("")
        actionable_rows = [
            (_as_string(item["action"]), _as_string(item["type"]), _as_string(item["address"]))
            for item in actionable_drift
        ]
        lines.extend(_markdown_table(actionable_rows))
    else:
        # The apply workflow intentionally checks this stable prefix before recreating a plan.
        lines.append("- None detected requiring managed reconciliation.")

    lines.extend(["", "## Non-overlapping refresh differences", ""])
    if refresh_only_drift:
        refresh_rows = [
            (_as_string(item["action"]), _as_string(item["type"]), _as_string(item["address"]))
            for item in refresh_only_drift
        ]
        lines.extend(_markdown_table(refresh_rows))
        lines.extend(
            [
                "",
                "These differences do not overlap any field Terraform plans to change. They are "
                "reported for review but are not applied or reconciled by this plan.",
            ]
        )
    else:
        lines.append("- None detected")

    lines.extend(["", "## Resource-type allowlist", ""])
    if unexpected_types:
        lines.extend(f"- Unreviewed: `{resource_type}`" for resource_type in unexpected_types)
    else:
        lines.append("- All changed resource types are part of the reviewed staging design")

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
            "Remote-state drift is always reported. It blocks progression only when a drifted "
            "structural path overlaps a field Terraform plans to reconcile, or when the changed "
            "paths cannot be classified safely. Provider-computed or other non-overlapping "
            "refresh differences remain visible without blocking an unrelated managed change.",
            "Any new Terraform resource type must be added to the reviewed staging design and "
            "allowlist in the same pull request before the plan can pass.",
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
    parser = argparse.ArgumentParser(description="Create a redacted Terraform plan review summary.")
    parser.add_argument("--plan-json", type=Path, required=True)
    parser.add_argument("--plan-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--plan-exit-code", type=int, required=True)
    parser.add_argument("--allow-staging-public-invoker", action="store_true")
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
        allow_staging_public_invoker=args.allow_staging_public_invoker,
    )
    args.output.write_text(markdown, encoding="utf-8")
    if summary_path := os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(summary_path).open("a", encoding="utf-8") as summary_file:
            summary_file.write(markdown)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
