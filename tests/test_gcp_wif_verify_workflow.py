from pathlib import Path

WORKFLOW = Path(".github/workflows/gcp-wif-verify.yml")
RUNBOOK = Path("docs/runbooks/gcp-wif-state-boundary.md")


def test_wif_verify_uses_only_oidc_token_permission() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")
    permissions = content.split("permissions:", maxsplit=1)[1].split("concurrency:", maxsplit=1)[0]

    assert "id-token: write" in permissions
    assert "contents:" not in permissions
    assert "actions:" not in permissions
    assert "packages:" not in permissions
    assert "pull-requests:" not in permissions
    assert "GitHub token permissions: OIDC only; repository contents unavailable" in content


def test_wif_verify_fails_closed_on_identity_shape_and_state_bucket_controls() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        '"projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"',
        '"github-deploy@${PROJECT_ID}.iam.gserviceaccount.com"',
        "Verify protected Terraform state bucket boundary",
        'bucket.get("projectNumber", "")',
        'location == "AUSTRALIA-SOUTHEAST1"',
        'uniform_access.get("enabled") is True',
        'publicAccessPrevention") == "enforced"',
        'versioning.get("enabled") is True',
        "gcloud storage buckets get-iam-policy",
        '{"allUsers", "allAuthenticatedUsers"}',
        'binding.get("role") == "roles/storage.objectAdmin"',
        "assert object_admin_members == {deploy_member}",
        "trap 'rm -f",
        "Public IAM principals: none",
        "State writer binding: exact deploy service account only",
        "GCP resources changed: none",
    ]:
        assert phrase in content

    assert "gcloud storage buckets update" not in content
    assert "gcloud storage buckets create" not in content
    assert "gcloud storage buckets set-iam-policy" not in content
    assert "terraform apply" not in content


def test_wif_verify_retains_only_reviewable_non_sensitive_evidence() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        "Create reviewable verification evidence",
        'evidence_file="${RUNNER_TEMP}/gcp-wif-verification.md"',
        'run_url="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"',
        "Source commit:",
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
        "raw bucket metadata and IAM policy are deleted",
    ]:
        assert phrase in content
