from pathlib import Path

from cdl_api.terraform_plan_summary import summarize_plan

WORKFLOW = Path(".github/workflows/gcp-terraform-staging.yml")
RUNBOOK = Path("docs/runbooks/gcp-staging-saved-plan.md")


def _plan(
    resource_changes: list[dict[str, object]],
    *,
    resource_drift: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    plan: dict[str, object] = {
        "format_version": "1.2",
        "terraform_version": "1.15.8",
        "resource_changes": resource_changes,
    }
    if resource_drift is not None:
        plan["resource_drift"] = resource_drift
    return plan


def test_authenticated_plan_saves_and_uploads_only_reviewable_evidence() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        "-detailed-exitcode",
        '-out="${RUNNER_TEMP}/staging.tfplan"',
        'terraform show -no-color "${RUNNER_TEMP}/staging.tfplan"',
        'terraform show -json "${RUNNER_TEMP}/staging.tfplan"',
        "terraform_plan_summary.py",
        "Verify reviewable plan evidence completeness",
        'test -s "${RUNNER_TEMP}/staging-plan.txt"',
        'test -s "${RUNNER_TEMP}/staging-plan-summary.md"',
        "## Detected remote-state drift",
        "actions/upload-artifact@v4",
        "retention-days: 7",
        "staging-plan.txt",
        "staging-plan-summary.md",
        "staging-plan-manifest.json",
        "terraform_plan_manifest.py",
        "Create immutable plan identity manifest",
        '"schema_version": "staging-terraform-plan/v1"',
        "steps.evidence.outcome == 'success'",
        "steps.plan_summary.outcome == 'failure'",
        "steps.evidence.outcome == 'failure'",
    ]:
        assert phrase in content

    artifact_section = content.split("uses: actions/upload-artifact@v4", maxsplit=1)[1]
    artifact_section = artifact_section.split(
        "- name: Enforce staging plan safety gate", maxsplit=1
    )[0]
    assert ".tfplan" not in artifact_section
    assert "staging-plan.json" not in artifact_section
    assert "terraform apply" not in content


def test_plan_manifest_is_created_before_executable_plan_cleanup() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    manifest_index = content.index("- name: Create immutable plan identity manifest")
    cleanup_index = content.index("- name: Remove machine-readable and executable plan files")
    evidence_index = content.index("- name: Verify reviewable plan evidence completeness")
    upload_index = content.index("- name: Upload reviewable plan evidence")

    assert manifest_index < cleanup_index < evidence_index < upload_index
    for phrase in [
        "--source-sha \"${GITHUB_SHA}\"",
        "--run-id \"${GITHUB_RUN_ID}\"",
        "--deployment-stage \"${DEPLOYMENT_STAGE}\"",
        "--state-bucket \"${TERRAFORM_STATE_BUCKET}\"",
        "--backend-image \"${BACKEND_IMAGE}\"",
        "--enable-database-jobs \"${ENABLE_DATABASE_JOBS}\"",
        "--enable-cloud-run \"${ENABLE_CLOUD_RUN}\"",
        "steps.manifest.outcome == 'failure'",
    ]:
        assert phrase in content


def test_plan_evidence_upload_fails_closed_when_summary_is_missing() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    remove_index = content.index("- name: Remove machine-readable and executable plan files")
    verify_index = content.index("- name: Verify reviewable plan evidence completeness")
    upload_index = content.index("- name: Upload reviewable plan evidence")
    enforce_index = content.index("- name: Enforce staging plan safety gate")

    assert remove_index < verify_index < upload_index < enforce_index

    upload_header = content[upload_index : content.index("uses: actions/upload-artifact@v4")]
    assert "steps.evidence.outcome == 'success'" in upload_header

    verify_section = content[verify_index:upload_index]
    assert "staging-plan-summary.md" in verify_section
    assert "# Staging Terraform plan review" in verify_section
    assert "## Detected remote-state drift" in verify_section
    assert "not retained or uploaded" in verify_section


def test_authenticated_plan_requires_complete_keyless_environment() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for variable in [
        "GCP_STAGING_PROJECT_ID",
        "GCP_STAGING_PROJECT_NUMBER",
        "GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER",
        "GCP_STAGING_DEPLOY_SERVICE_ACCOUNT",
        "GCP_TERRAFORM_STATE_BUCKET",
    ]:
        assert variable in content

    assert "github.ref == 'refs/heads/main'" in content
    assert "environment: staging" in content


def test_plan_summary_redacts_values_and_lists_cost_sensitive_changes() -> None:
    plan = _plan(
        [
            {
                "address": "module.cloud_sql.google_sql_database_instance.this",
                "type": "google_sql_database_instance",
                "change": {
                    "actions": ["create"],
                    "after": {
                        "name": "cdl-staging-postgres",
                        "sensitive_field": "must-not-appear",
                    },
                },
            },
        ]
    )

    summary, exit_code = summarize_plan(
        plan,
        plan_sha256="abc123",
        plan_exit_code=2,
        source_sha="deadbeef",
        run_url="https://github.com/example/actions/runs/1",
    )

    assert exit_code == 0
    assert "Safety gate: **PASS**" in summary
    assert "google_sql_database_instance" in summary
    assert "Cloud SQL compute" in summary
    assert "reviewed staging design" in summary
    assert "Detected remote-state drift" in summary
    assert "None detected" in summary
    assert "must-not-appear" not in summary
    assert "abc123" in summary


def test_plan_summary_blocks_destructive_actions() -> None:
    plan = _plan(
        [
            {
                "address": "google_storage_bucket.frontend",
                "type": "google_storage_bucket",
                "change": {"actions": ["delete"], "after": None},
            },
        ]
    )

    summary, exit_code = summarize_plan(
        plan,
        plan_sha256="abc123",
        plan_exit_code=2,
        source_sha="deadbeef",
        run_url="",
    )

    assert exit_code == 2
    assert "BLOCKED: destructive delete or replacement action detected" in summary


def test_plan_summary_blocks_public_principals() -> None:
    plan = _plan(
        [
            {
                "address": "google_cloud_run_v2_service_iam_member.public",
                "type": "google_cloud_run_v2_service_iam_member",
                "change": {
                    "actions": ["create"],
                    "after": {"member": "allUsers"},
                },
            },
        ]
    )

    summary, exit_code = summarize_plan(
        plan,
        plan_sha256="abc123",
        plan_exit_code=2,
        source_sha="deadbeef",
        run_url="",
    )

    assert exit_code == 3
    assert "BLOCKED: public IAM principal detected" in summary


def test_plan_summary_blocks_unreviewed_resource_types() -> None:
    plan = _plan(
        [
            {
                "address": "google_compute_instance.unreviewed",
                "type": "google_compute_instance",
                "change": {
                    "actions": ["create"],
                    "after": {"machine_type": "e2-medium"},
                },
            },
        ]
    )

    summary, exit_code = summarize_plan(
        plan,
        plan_sha256="abc123",
        plan_exit_code=2,
        source_sha="deadbeef",
        run_url="",
    )

    assert exit_code == 4
    assert "BLOCKED: unreviewed staging resource type detected" in summary
    assert "Unreviewed: `google_compute_instance`" in summary


def test_plan_summary_blocks_remote_state_drift() -> None:
    plan = _plan(
        [],
        resource_drift=[
            {
                "address": "module.cloud_sql.google_sql_database_instance.this",
                "type": "google_sql_database_instance",
                "change": {
                    "actions": ["update"],
                    "before": {"deletion_protection": True},
                    "after": {"deletion_protection": False},
                },
            }
        ],
    )

    summary, exit_code = summarize_plan(
        plan,
        plan_sha256="abc123",
        plan_exit_code=0,
        source_sha="deadbeef",
        run_url="",
    )

    assert exit_code == 5
    assert "BLOCKED: out-of-band resource drift detected" in summary
    assert "module.cloud_sql.google_sql_database_instance.this" in summary
    assert "deletion_protection" not in summary
    assert "Any detected remote-state drift must be explained" in summary


def test_runbook_documents_saved_plan_review_boundary() -> None:
    content = RUNBOOK.read_text(encoding="utf-8")

    for phrase in [
        "seven days",
        "binary plan and machine-readable JSON are deleted",
        "complete human-readable plan and redacted summary",
        "incomplete evidence is never uploaded",
        "destructive delete or replacement",
        "public IAM principal",
        "unreviewed Terraform resource type",
        "out-of-band resource drift",
        "cost-sensitive resource categories",
        "never applies infrastructure",
    ]:
        assert phrase in content
