from pathlib import Path

WORKFLOW = Path(".github/workflows/gcp-wif-verify.yml")
RUNBOOK = Path("docs/runbooks/gcp-wif-state-boundary.md")


def test_wif_verify_runs_once_when_its_contract_lands_on_main_and_keeps_manual_retry() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")
    trigger = content.split("on:", maxsplit=1)[1].split("permissions:", maxsplit=1)[0]

    for phrase in [
        "push:",
        "branches:",
        "- main",
        "paths:",
        '- ".github/workflows/gcp-wif-verify.yml"',
        "workflow_dispatch:",
    ]:
        assert phrase in trigger

    assert "pull_request:" not in trigger
    assert 'test "${GITHUB_REF}" = "refs/heads/main"' in content


def test_wif_verify_reports_missing_variable_names_without_printing_values() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")
    validation = content.split("- name: Validate required environment variables", maxsplit=1)[
        1
    ].split("- name: Authenticate to Google Cloud", maxsplit=1)[0]

    for phrase in [
        "require_configured_variable",
        "Missing staging environment variable",
        "GCP_STAGING_PROJECT_ID",
        "GCP_STAGING_PROJECT_NUMBER",
        "GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER",
        "GCP_STAGING_DEPLOY_SERVICE_ACCOUNT",
        "GCP_TERRAFORM_STATE_BUCKET",
    ]:
        assert phrase in validation

    for secret_value_expansion in [
        'echo "${PROJECT_ID}"',
        'echo "${PROJECT_NUMBER}"',
        'echo "${WORKLOAD_IDENTITY_PROVIDER}"',
        'echo "${DEPLOY_SERVICE_ACCOUNT}"',
        'echo "${TERRAFORM_STATE_BUCKET}"',
    ]:
        assert secret_value_expansion not in validation


def test_wif_verify_uses_only_oidc_token_permission() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")
    permissions = content.split("permissions:", maxsplit=1)[1].split("concurrency:", maxsplit=1)[0]

    assert "id-token: write" in permissions
    assert "contents:" not in permissions
    assert "actions:" not in permissions
    assert "packages:" not in permissions
    assert "pull-requests:" not in permissions
    assert "GitHub token permissions: OIDC only; repository contents unavailable" in content


def test_wif_verify_fails_closed_with_named_state_bucket_diagnostics() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")
    verification = content.split(
        "- name: Verify protected Terraform state bucket boundary", maxsplit=1
    )[1].split("- name: Create reviewable verification evidence", maxsplit=1)[0]

    assert (
        '"projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/'
        'github-pool/providers/github-provider"' in content
    )
    assert '"github-deploy@${PROJECT_ID}.iam.gserviceaccount.com"' in content

    for phrase in [
        "gcloud storage buckets get-iam-policy",
        "State bucket boundary mismatch",
        'require_equal("project number"',
        'require_equal("location"',
        'require_equal("uniform bucket-level access"',
        '"public access prevention"',
        'require_equal("object versioning"',
        'require_equal("public IAM principals"',
        'require_equal("state writer binding"',
        'binding.get("role") == "roles/storage.objectAdmin"',
        "raise SystemExit(1)",
        "trap 'rm -f",
    ]:
        assert phrase in verification

    assert "assert actual_project_number" not in verification
    assert "assert object_admin_members" not in verification
    assert "gcloud storage buckets update" not in content
    assert "gcloud storage buckets create" not in content
    assert "gcloud storage buckets set-iam-policy" not in content
    assert "terraform apply" not in content


def test_wif_verify_retains_exact_reviewable_non_sensitive_identity_evidence() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        "Create reviewable verification evidence",
        'evidence_file="${RUNNER_TEMP}/gcp-wif-verification.md"',
        'run_url="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"',
        "Source commit:",
        "Trigger:",
        'grep -Fq "Trigger: \\`${GITHUB_EVENT_NAME}\\`"',
        "Workload Identity provider:",
        "Terraform state bucket:",
        'grep -Fq "Workload Identity provider: \\`${WORKLOAD_IDENTITY_PROVIDER}\\`"',
        'grep -Fq "Terraform state bucket: \\`gs://${TERRAFORM_STATE_BUCKET}\\`"',
        "GitHub token permissions: OIDC only; repository contents unavailable",
        "Raw bucket metadata and IAM policy: deleted and not retained",
        "actions/upload-artifact@v4",
        "gcp-wif-verification-${{ github.sha }}",
        "if-no-files-found: error",
        "retention-days: 7",
    ]:
        assert phrase in content

    upload_section = content.split("uses: actions/upload-artifact@v4", maxsplit=1)[1]
    assert "terraform-state-bucket.json" not in upload_section
    assert "terraform-state-bucket-iam.json" not in upload_section
    assert "gcp-wif-verification.md" in upload_section


def test_wif_runbook_documents_state_bucket_security_proof() -> None:
    content = RUNBOOK.read_text(encoding="utf-8")

    for phrase in [
        "state bucket belongs to the configured staging project number",
        "australia-southeast1",
        "uniform bucket-level access",
        "public access prevention",
        "no public IAM principals",
        "only explicit `roles/storage.objectAdmin` member",
        "object versioning",
        "read-only",
        "OIDC token minting",
        "repository contents",
        "seven days",
        "source commit",
        "workflow run",
        "exact Workload Identity provider path",
        "exact Terraform state bucket name",
        "raw bucket metadata and IAM policy are deleted",
        "automatically once",
        "missing variable names",
        "named boundary check",
        "expected and actual values",
        "manual retry",
    ]:
        assert phrase in content
