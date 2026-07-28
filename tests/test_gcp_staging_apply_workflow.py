from pathlib import Path

WORKFLOW = Path(".github/workflows/gcp-terraform-apply-staging.yml")
RUNBOOK = Path("docs/runbooks/gcp-staging-apply.md")


def test_apply_workflow_is_manual_main_only_and_double_confirmed() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        "workflow_dispatch:",
        "reviewed_plan_run_id:",
        "reviewed_source_sha:",
        "deployment_stage:",
        "approval_reference:",
        "approval_phrase:",
        "confirm_apply:",
        "github.event_name == 'workflow_dispatch'",
        "github.ref == 'refs/heads/main'",
        "inputs.confirm_apply == true",
        'test "${GITHUB_SHA}" = "${REVIEWED_SOURCE_SHA}"',
        'test "${APPROVAL_PHRASE}" = "APPLY STAGING ${DEPLOYMENT_STAGE}"',
        "environment: staging",
        "cancel-in-progress: false",
    ]:
        assert phrase in content

    assert "push:" not in content


def test_apply_workflow_downloads_exact_reviewed_plan_evidence() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        "actions: read",
        "contents: read",
        "id-token: write",
        "actions/download-artifact@v4",
        "staging-terraform-plan-${{ inputs.reviewed_source_sha }}-${{ inputs.deployment_stage }}",
        "staging-plan-manifest.json",
        "Verify exact reviewed plan manifest",
        "terraform_plan_manifest.py",
        "run-id: ${{ inputs.reviewed_plan_run_id }}",
        "Safety gate: **PASS**",
        'f"Source commit: `{source_sha}`"',
        'f"/actions/runs/{run_id}"',
        "## Detected remote-state drift\\n\\n- None detected",
        "Binary plan and machine-readable JSON: not retained or uploaded",
        "ref: ${{ inputs.reviewed_source_sha }}",
        "persist-credentials: false",
    ]:
        assert phrase in content


def test_apply_workflow_verifies_manifest_before_authentication_and_apply() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    checkout_index = content.index("- name: Checkout exact reviewed source")
    manifest_index = content.index("- name: Verify exact reviewed plan manifest")
    auth_index = content.index("- name: Authenticate to Google Cloud")
    apply_index = content.index("- name: Apply exact recreated saved plan")

    assert checkout_index < manifest_index < auth_index < apply_index
    for phrase in [
        "--manifest \"${RUNNER_TEMP}/reviewed-plan/staging-plan-manifest.json\"",
        "--source-sha \"${REVIEWED_SOURCE_SHA}\"",
        "--run-id \"${REVIEWED_PLAN_RUN_ID}\"",
        "--deployment-stage \"${DEPLOYMENT_STAGE}\"",
        "--project-id \"${PROJECT_ID}\"",
        "--state-bucket \"${TERRAFORM_STATE_BUCKET}\"",
        "--backend-image \"${BACKEND_IMAGE}\"",
        "Reviewed plan manifest SHA-256",
        "Reviewed plan manifest identity: verified",
    ]:
        assert phrase in content


def test_apply_workflow_recreates_gates_and_compares_the_plan_before_apply() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    recreate_index = content.index("- name: Recreate reviewed staging plan")
    gate_index = content.index("- name: Render and gate recreated plan")
    compare_index = content.index("- name: Require exact reviewed plan text")
    apply_index = content.index("- name: Apply exact recreated saved plan")
    post_apply_index = content.index("- name: Verify post-apply no-change state")

    assert recreate_index < gate_index < compare_index < apply_index < post_apply_index

    for phrase in [
        "-detailed-exitcode",
        '-out="${RUNNER_TEMP}/recreated.tfplan"',
        "terraform_plan_summary.py",
        'cmp -s "${reviewed_plan}" "${recreated_plan}"',
        'terraform apply -input=false "${RUNNER_TEMP}/recreated.tfplan"',
        "Post-apply Terraform plan was not a clean no-change result.",
        '-var="allow_public_invoker=false"',
    ]:
        assert phrase in content


def test_apply_workflow_preserves_cumulative_stage_and_image_boundaries() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        "foundation)",
        "database-jobs)",
        "runtime)",
        "enable_database_jobs=false",
        "enable_database_jobs=true",
        "enable_cloud_run=false",
        "enable_cloud_run=true",
        "cdl-react-backend/cdl-react-app@sha256:",
        "backend_image must be the immutable staging application digest URI.",
    ]:
        assert phrase in content


def test_apply_workflow_enforces_prior_stages_and_verifies_live_resources() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    prerequisite_index = content.index("- name: Enforce cumulative stage prerequisites")
    recreate_index = content.index("- name: Recreate reviewed staging plan")
    apply_index = content.index("- name: Apply exact recreated saved plan")
    verify_index = content.index("- name: Verify applied stage resources and access boundary")
    evidence_index = content.index("- name: Create reviewable apply evidence")

    assert prerequisite_index < recreate_index < apply_index < verify_index < evidence_index

    for phrase in [
        "terraform state list",
        "Required prior-stage resource is absent from Terraform state",
        "module.artifact_registry.google_artifact_registry_repository.this",
        "module.frontend_assets.google_storage_bucket.this",
        "module.cloud_sql.google_sql_database_instance.this",
        "google_service_account.runtime",
        "google_service_account.migration",
        "google_cloud_run_v2_job.database_migration[0]",
        "google_cloud_run_v2_job.synthetic_seed[0]",
        "gcloud artifacts repositories describe cdl-react-backend",
        "cdl-api-runtime@${PROJECT_ID}.iam.gserviceaccount.com",
        "cdl-db-migration@${PROJECT_ID}.iam.gserviceaccount.com",
        "gs://${PROJECT_ID}-frontend-assets",
        "gcloud sql instances describe cdl-react-staging-postgres",
        "settings.ipConfiguration.authorizedNetworks[].value",
        "gcloud run jobs describe",
        "gcloud run services describe cdl-react-staging-api",
        "gcloud run services get-iam-policy cdl-react-staging-api",
        '{"allUsers", "allAuthenticatedUsers"}',
        "Live stage resource verification: passed",
        "Cloud SQL authorized networks: none",
    ]:
        assert phrase in content


def test_apply_workflow_retains_only_reviewable_apply_evidence() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        "Create reviewable apply evidence",
        "Recreated plan exact-text comparison: passed",
        "Post-apply no-change plan: passed",
        "Executable and machine-readable plans retained: no",
        "Remove executable and machine-readable plan files",
        "actions/upload-artifact@v4",
        "staging-terraform-apply.md",
        "retention-days: 7",
    ]:
        assert phrase in content

    upload_section = content.split("- name: Upload reviewable apply evidence", maxsplit=1)[1]
    assert ".tfplan" not in upload_section
    assert ".json" not in upload_section


def test_apply_runbook_documents_review_and_execution_boundaries() -> None:
    content = RUNBOOK.read_text(encoding="utf-8")

    for phrase in [
        "GCP WIF Verify",
        "GCP Terraform Staging",
        "exact source commit",
        "reviewed workflow run ID",
        "cost/security assessment",
        "exact text match",
        "foundation",
        "database-jobs",
        "runtime",
        "immutable Artifact Registry digest",
        "public access remains disabled",
        "post-apply no-change plan",
        "does not run automatically",
        "No executable plan is retained",
    ]:
        assert phrase in content
