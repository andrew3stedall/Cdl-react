"""Create and verify non-sensitive Terraform staging plan identity manifests."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "staging-terraform-plan/v1"
STAGES = {"foundation", "database-jobs", "runtime"}


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _parse_bool(value: str) -> bool:
    if value == "true":
        return True
    if value == "false":
        return False
    raise ValueError(f"Expected true or false, received: {value}")


def build_manifest(
    *,
    plan_text: Path,
    backend_config: Path,
    source_sha: str,
    run_id: str,
    deployment_stage: str,
    project_id: str,
    state_bucket: str,
    backend_image: str,
    enable_database_jobs: bool,
    enable_cloud_run: bool,
    enable_google_sign_in: bool,
    allow_public_invoker: bool,
) -> dict[str, Any]:
    valid_source_sha = len(source_sha) == 40 and all(
        character in "0123456789abcdef" for character in source_sha
    )
    if not valid_source_sha:
        raise ValueError("source_sha must be 40 lowercase hexadecimal characters")
    if not run_id.isdigit():
        raise ValueError("run_id must be numeric")
    if deployment_stage not in STAGES:
        raise ValueError(f"Unsupported deployment stage: {deployment_stage}")
    if not project_id or not state_bucket:
        raise ValueError("project_id and state_bucket are required")

    expected_flags = {
        "foundation": (False, False),
        "database-jobs": (True, False),
        "runtime": (True, True),
    }[deployment_stage]
    if (enable_database_jobs, enable_cloud_run) != expected_flags:
        raise ValueError("Terraform feature flags do not match the cumulative deployment stage")
    if deployment_stage == "foundation" and backend_image:
        raise ValueError("foundation must not include a backend image")
    if deployment_stage != "foundation" and "@sha256:" not in backend_image:
        raise ValueError("later stages require an immutable backend image digest")
    if allow_public_invoker and deployment_stage != "runtime":
        raise ValueError("public invocation is supported only for the runtime stage")
    if enable_google_sign_in and (deployment_stage != "runtime" or not allow_public_invoker):
        raise ValueError(
            "Google sign-in is supported only for the public application-login runtime"
        )

    terraform_inputs = {
        "allow_public_invoker": allow_public_invoker,
        "backend_image": backend_image,
        "enable_cloud_run": enable_cloud_run,
        "enable_database_jobs": enable_database_jobs,
        "enable_google_sign_in": enable_google_sign_in,
        "project_id": project_id,
    }
    canonical_inputs = json.dumps(
        terraform_inputs,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()

    return {
        "schema_version": SCHEMA_VERSION,
        "source_sha": source_sha,
        "plan_workflow_run_id": run_id,
        "deployment_stage": deployment_stage,
        "backend": {
            "bucket": state_bucket,
            "prefix": "environments/staging",
            "config_sha256": _sha256(backend_config),
        },
        "terraform_inputs": terraform_inputs,
        "terraform_inputs_sha256": hashlib.sha256(canonical_inputs).hexdigest(),
        "reviewed_plan_text_sha256": _sha256(plan_text),
    }


def write_manifest(manifest: dict[str, Any], output: Path) -> None:
    output.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def verify_manifest(expected: dict[str, Any], actual: dict[str, Any]) -> None:
    if actual != expected:
        expected_text = json.dumps(expected, indent=2, sort_keys=True)
        actual_text = json.dumps(actual, indent=2, sort_keys=True)
        raise ValueError(
            "Reviewed plan manifest does not match the requested apply identity.\n"
            f"Expected:\n{expected_text}\nActual:\n{actual_text}"
        )


def _common_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--plan-text", type=Path, required=True)
    parser.add_argument("--backend-config", type=Path, required=True)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--deployment-stage", required=True)
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--state-bucket", required=True)
    parser.add_argument("--backend-image", default="")
    parser.add_argument("--enable-database-jobs", required=True)
    parser.add_argument("--enable-cloud-run", required=True)
    parser.add_argument("--enable-google-sign-in", required=True)
    parser.add_argument("--allow-public-invoker", required=True)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create")
    _common_arguments(create_parser)
    create_parser.add_argument("--output", type=Path, required=True)

    verify_parser = subparsers.add_parser("verify")
    _common_arguments(verify_parser)
    verify_parser.add_argument("--manifest", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    expected = build_manifest(
        plan_text=args.plan_text,
        backend_config=args.backend_config,
        source_sha=args.source_sha,
        run_id=args.run_id,
        deployment_stage=args.deployment_stage,
        project_id=args.project_id,
        state_bucket=args.state_bucket,
        backend_image=args.backend_image,
        enable_database_jobs=_parse_bool(args.enable_database_jobs),
        enable_cloud_run=_parse_bool(args.enable_cloud_run),
        enable_google_sign_in=_parse_bool(args.enable_google_sign_in),
        allow_public_invoker=_parse_bool(args.allow_public_invoker),
    )

    if args.command == "create":
        write_manifest(expected, args.output)
        return 0

    actual = json.loads(args.manifest.read_text(encoding="utf-8"))
    verify_manifest(expected, actual)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
