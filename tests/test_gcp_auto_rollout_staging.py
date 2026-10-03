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
        '"google_cloud_run_v2_job_iam_member.fpl_refresh_scheduler_invoker[0]"',
        '"google_cloud_scheduler_job.fpl_refresh[0]"',
        '"google_project_iam_member.github_deploy_scheduler_admin"',
        "enable_scheduled_fpl_refresh=true",
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


def test_auto_rollout_pins_existing_traffic_until_verified_migration() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")
    capture = content.index("- name: Pin currently healthy revision during rollout")
    apply = content.index("- name: Apply exact automatic staging plan")
    migration = content.index("- name: Run database migrations")
    diagnose = content.index("- name: Diagnose database migration failure")
    verify_staged = content.index("- name: Verify new revision before traffic promotion")
    smoke_staged = content.index("- name: Smoke staged revision before traffic promotion")
    promote = content.index("- name: Promote staged revision after migration")

    assert capture < apply < migration < verify_staged < smoke_staged < promote < diagnose
    assert content.count('-var="runtime_traffic_revision=${RUNTIME_TRAFFIC_REVISION}"') == 2
    assert "if: steps.database-migrations.outcome == 'success'" in content
    assert "if: steps.database-migrations.outcome == 'failure'" in content
    assert "scripts/cloud_run_staged_revision.py pin" in content
    assert "scripts/cloud_run_staged_revision.py verify" in content
    assert '"${candidate_url}/health"' in content
    assert '"${candidate_url}/api/fpl/status"' in content
    assert '--update-tags="${CANDIDATE_TAG}=${STAGED_REVISION}"' in content
    assert 'candidate-url \\\n            "${RUNNER_TEMP}/candidate-service.json"' in content
    assert '--to-revisions "${STAGED_REVISION}=100"' in content
    assert '--remove-tags="${CANDIDATE_TAG}"' in content
    assert "if: always() && env.CANDIDATE_TAG != ''" in content
    assert 'gcloud run revisions describe "${STAGED_REVISION}"' not in content


def test_runtime_service_has_a_stage_with_prior_revision_traffic_pin() -> None:
    module = Path("infra/terraform/modules/cloud-run-api/main.tf").read_text(encoding="utf-8")
    variables = Path("infra/terraform/modules/cloud-run-api/variables.tf").read_text(
        encoding="utf-8"
    )

    assert 'variable "traffic_revision"' in variables
    assert '"TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION"' in module
    assert "revision = var.traffic_revision" in module
    assert "percent  = 100" in module
    assert "Staging revisions must pin an existing healthy traffic revision" in module


def test_direct_fallback_migrates_and_smokes_before_promoting_traffic() -> None:
    content = Path(".github/workflows/gcp-direct-staging-rollout.yml").read_text(encoding="utf-8")
    migration = content.index(
        "- name: Run and verify migrations before changing application traffic"
    )
    stage = content.index("- name: Stage image without changing application traffic")
    smoke = content.index("- name: Verify staged revision and retained traffic")
    promote = content.index("- name: Promote staged revision after migration smoke checks")
    verify_live = content.index("- name: Verify promoted revision health and auth boundary")

    assert migration < stage < smoke < promote < verify_live
    assert "--no-traffic" in content
    assert "scripts/cloud_run_staged_revision.py pin" in content
    assert "scripts/cloud_run_staged_revision.py verify" in content
    assert '--to-revisions "${STAGED_REVISION}=100"' in content
    assert content.index('gcloud run jobs execute "${migration_job}"') < stage
    assert '--update-tags="${CANDIDATE_TAG}=${latest_ready}"' in content
    assert 'candidate-url \\\n            "${RUNNER_TEMP}/candidate-service.json"' in content
    assert '--remove-tags="${CANDIDATE_TAG}"' in content


def test_runtime_images_and_ci_install_from_checked_in_locks() -> None:
    dockerfile = Path("Dockerfile").read_text(encoding="utf-8")
    ci = Path(".github/workflows/ci.yml").read_text(encoding="utf-8")
    postgres_ci = Path(".github/workflows/backend-postgres.yml").read_text(encoding="utf-8")

    assert "COPY frontend/package.json frontend/package-lock.json ./" in dockerfile
    assert "RUN npm ci --no-audit --no-fund" in dockerfile
    assert "COPY pyproject.toml uv.lock ./" in dockerfile
    assert "uv sync --frozen --no-dev" in dockerfile
    assert "uv sync --locked" in ci
    assert "npm ci" in ci
    assert "uv sync --locked" in postgres_ci


def test_migration_entrypoint_checks_the_database_revision_after_upgrade() -> None:
    migration = Path("src/cdl_api/migrate.py").read_text(encoding="utf-8")

    assert 'command.upgrade(config, "head")' in migration
    assert "verify_schema_head(config, os.environ[DATABASE_URL_ENV])" in migration
    assert "MigrationContext.configure(connection).get_current_heads()" in migration
    assert "Alembic schema verification failed" in migration
    assert "Alembic schema verification passed" in migration


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


def test_official_fpl_refresh_has_a_deadline_independent_scheduler() -> None:
    content = DATABASE_JOBS.read_text(encoding="utf-8")
    section = content.split('resource "google_cloud_scheduler_job" "fpl_refresh"', maxsplit=1)[1]

    for phrase in (
        "var.enable_database_jobs && var.enable_scheduled_fpl_refresh",
        'schedule         = "*/5 * * * *"',
        'time_zone        = "Etc/UTC"',
        "google_cloud_run_v2_job.fpl_refresh[0].name",
        "google_service_account.migration.email",
        'http_method = "POST"',
    ):
        assert phrase in section


def test_official_fpl_refresh_job_is_exposed_as_a_terraform_output() -> None:
    content = OUTPUTS.read_text(encoding="utf-8")

    assert 'output "fpl_refresh_job_name"' in content
    assert "google_cloud_run_v2_job.fpl_refresh[0].name" in content


def test_official_fpl_refresh_schedule_is_output_and_verified_after_rollout() -> None:
    outputs = OUTPUTS.read_text(encoding="utf-8")
    workflow = WORKFLOW.read_text(encoding="utf-8")

    assert 'output "fpl_refresh_schedule_name"' in outputs
    assert "google_cloud_scheduler_job.fpl_refresh[0].name" in outputs
    assert "Verify deadline settlement schedule" in workflow
    assert 'value(schedule)\')" = "*/5 * * * *"' in workflow


def test_manual_database_job_workflow_can_refresh_official_fpl_data() -> None:
    content = DATABASE_JOB_WORKFLOW.read_text(encoding="utf-8")

    assert "- fpl-refresh" in content
    assert "fpl-refresh)" in content
    assert 'job_name="cdl-react-staging-fpl-refresh"' in content
    assert "confirm_synthetic_data" in content


def test_reviewed_runtime_apply_smokes_and_promotes_the_exact_ready_revision() -> None:
    content = Path(".github/workflows/gcp-terraform-apply-staging.yml").read_text(encoding="utf-8")
    smoke = content.index("- name: Smoke staged runtime before traffic promotion")
    promote = content.index("- name: Promote runtime after migration and smoke checks")
    assert smoke < promote
    assert "scripts/cloud_run_staged_revision.py pin" in content
    assert "scripts/cloud_run_staged_revision.py verify" in content
    assert '"${candidate_url}/health"' in content
    assert '"${candidate_url}/api/fpl/status"' in content
    assert '--update-tags="${CANDIDATE_TAG}=${revision}"' in content
    assert 'candidate-url \\\n            "${RUNNER_TEMP}/candidate-service.json"' in content
    assert '--to-revisions "${STAGED_REVISION}=100"' in content
    assert '--remove-tags="${CANDIDATE_TAG}"' in content
