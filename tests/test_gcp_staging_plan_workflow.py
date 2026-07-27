from pathlib import Path

from cdl_api.terraform_plan_summary import summarize_plan

WORKFLOW = Path(".github/workflows/gcp-terraform-staging.yml")
RUNBOOK = Path("docs/runbooks/gcp-staging-saved-plan.md")


def _plan(resource_changes: list[dict[str, object]]) -> dict[str, object]:
    return {
        "format_version": "1.2",
        "terraform_version": "1.15.8",
        "resource_changes": resource_changes,
    }


def test_authenticated_plan_saves_and_uploads_only_reviewable_evidence() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        "-detailed-exitcode",
        '-out="${RUNNER_TEMP}/staging.tfplan"',
        'terraform show -no-color "${RUNNER_TEMP}/staging.tfplan"',
        'terraform show -json "${RUNNER_TEMP}/staging.tfplan"',
        "terraform_plan_summary.py",
        "actions/upload-artifact@v4",
        "retention-days: 7",
        "staging-plan.txt",
        "staging-plan-summary.md",
        "steps.plan_summary.outcome == 'failure'",
    ]:
        assert phrase in content

    artifact_section = content.split("uses: actions/upload-artifact@v4", maxsplit=1)[1]
    artifact_section = artifact_section.split(
        "- name: Enforce staging plan safety gate", maxsplit=1
    )[0]
    assert ".tfplan" not in artifact_section
    assert "staging-plan.json" not in artifact_section
    assert "terraform apply" not in content


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
            }
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
    assert "must-not-appear" not in summary
    assert "abc123" in summary


def test_plan_summary_blocks_destructive_actions() -> None:
    plan = _plan(
        [
            {
                "address": "google_storage_bucket.frontend",
                "type": "google_storage_bucket",
                "change": {"actions": ["delete"], "after": None},
            }
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
                "address": "google_storage_bucket_iam_member.public",
                "type": "google_storage_bucket_iam_member",
                "change": {
                    "actions": ["create"],
                    "after": {"member": "allUsers"},
                },
            }
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


def test_runbook_documents_saved_plan_review_boundary() -> None:
    content = RUNBOOK.read_text(encoding="utf-8")

    for phrase in [
        "seven days",
        "binary plan and machine-readable JSON are deleted",
        "destructive delete or replacement",
        "public IAM principal",
        "cost-sensitive resource categories",
        "never applies infrastructure",
    ]:
        assert phrase in content
