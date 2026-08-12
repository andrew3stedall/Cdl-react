from pathlib import Path

WORKFLOW = Path(".github/workflows/gcp-auto-rollout-staging.yml")
DATABASE_JOB_WORKFLOW = Path(".github/workflows/gcp-run-staging-database-job.yml")
DATABASE_JOBS = Path("infra/terraform/environments/staging/database_jobs.tf")
STAGING_MAIN = Path("infra/terraform/environments/staging/main.tf")
OUTPUTS = Path("infra/terraform/environments/staging/outputs.tf")


def test_auto_rollout_is_staging_only_and_failure_closed() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for phrase in (
        "GCP Auto Rollout Staging",
        "github.ref == 'refs/heads/main'",
        'test "${PROJECT_ID}" = "cdl-react-staging-ast"',
        "google-github-actions/auth@v3",
        "docker build --pull",
        "docker push",
        "terraform_plan_summary.py",
        "--allow-staging-public-invoker",
        "Automatic staging rollout contains non-allowlisted changes",
        '"google_cloud_run_v2_job.database_migration[0]"',
        '"google_cloud_run_v2_job.synthetic_seed[0]"',
        '"google_cloud_run_v2_job.fpl_refresh[0]"',
        '"module.cloud_run_api[0].google_cloud_run_v2_service.this"',
        '"google_secret_manager_secret_iam_member.migration_google_allowed_emails_access"',
        "terraform apply -input=false",
        "Post-rollout Terraform plan was not a clean no-change result.",
        'gcloud run jobs execute "${MIGRATION_JOB}"',
        'gcloud run jobs execute "${FPL_REFRESH_JOB}"',
        "Official FPL refresh job: completed with non-empty normalized data",
        "Unauthenticated FPL status boundary: HTTP 401",
    ):
        assert phrase in content

    assert 'gcloud run jobs execute "${SYNTHETIC_SEED_JOB}"' not in content
    assert "cdl-react-prod" not in content
    assert "terraform destroy" not in content
    assert "-auto-approve" not in content


def test_staging_migration_keeps_existing_secret_binding_address() -> None:
    content = STAGING_MAIN.read_text(encoding="utf-8")

    assert 'resource "google_secret_manager_secret_iam_member" "migration_secret_access"' in content
    assert 'secret_id = module.runtime_secrets.secret_names["cdl-database-url"]' in content
    assert (
        'resource "google_secret_manager_secret_iam_member" '
        '"migration_google_allowed_emails_access"'
    ) in content


def test_official_fpl_refresh_job_uses_the_migration_identity_and_database_only() -> None:
    content = DATABASE_JOBS.read_text(encoding="utf-8")
    section = content.split('resource "google_cloud_run_v2_job" "fpl_refresh"', maxsplit=1)[1]

    for phrase in (
        'name                = "${var.name_prefix}-fpl-refresh"',
        'args    = ["-m", "cdl_api.refresh_fpl"]',
        "google_service_account.migration.email",
        'module.runtime_secrets.secret_names["cdl-database-url"]',
        "deletion_protection = true",
        "max_retries     = 0",
        'timeout         = "900s"',
    ):
        assert phrase in section

    assert "cdl-development-login-secret" not in section
    assert "cdl-google-client-id" not in section
    assert "CDL_ALLOW_SYNTHETIC_STAGING_SEED" not in section


def test_official_fpl_refresh_job_is_exposed_as_a_terraform_output() -> None:
    content = OUTPUTS.read_text(encoding="utf-8")

    assert 'output "fpl_refresh_job_name"' in content
    assert "google_cloud_run_v2_job.fpl_refresh[0].name" in content


def test_manual_database_job_workflow_can_refresh_official_fpl_data() -> None:
    content = DATABASE_JOB_WORKFLOW.read_text(encoding="utf-8")

    assert "- fpl-refresh" in content
    assert "fpl-refresh)" in content
    assert 'job_name="cdl-react-staging-fpl-refresh"' in content
    assert "confirm_synthetic_data" in content
