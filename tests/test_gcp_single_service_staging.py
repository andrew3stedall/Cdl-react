from pathlib import Path

DOCKERFILE = Path("Dockerfile")
STAGING_MAIN = Path("infra/terraform/environments/staging/main.tf")
STAGING_VARIABLES = Path("infra/terraform/environments/staging/variables.tf")
DATABASE_JOBS = Path("infra/terraform/environments/staging/database_jobs.tf")
CLOUD_RUN_MAIN = Path("infra/terraform/modules/cloud-run-api/main.tf")
CLOUD_RUN_VARIABLES = Path("infra/terraform/modules/cloud-run-api/variables.tf")
PLAN_WORKFLOW = Path(".github/workflows/gcp-terraform-staging.yml")
IMAGE_WORKFLOW = Path(".github/workflows/gcp-deploy-staging.yml")
DATABASE_JOB_WORKFLOW = Path(".github/workflows/gcp-run-staging-database-job.yml")
DATABASE_CREDENTIAL_WORKFLOW = Path(
    ".github/workflows/gcp-bootstrap-staging-database-credential.yml"
)
ADR = Path("docs/architecture/gcp-single-service-staging.md")


def test_container_builds_and_packages_frontend_with_api() -> None:
    content = DOCKERFILE.read_text(encoding="utf-8")

    for phrase in [
        "FROM node:22-slim AS frontend-build",
        "COPY frontend/package.json ./",
        "RUN npm run build",
        "COPY --from=frontend-build /frontend/dist ./frontend-dist",
        "CDL_FRONTEND_DIST_DIR=/app/frontend-dist",
        "uvicorn cdl_api.app:app",
    ]:
        assert phrase in content


def test_staging_runtime_is_postgres_ready_but_disabled_by_default() -> None:
    main = STAGING_MAIN.read_text(encoding="utf-8")
    variables = STAGING_VARIABLES.read_text(encoding="utf-8")

    assert "default     = false" in variables
    assert 'default     = "postgres"' in variables
    assert "repository_mode               = var.runtime_repository_mode" in main
    assert "CDL_DATABASE_URL" in main
    assert "CDL_DEVELOPMENT_LOGIN_SECRET" in main
    assert 'CDL_SESSION_COOKIE_SECURE = "true"' in main
    assert "allow_public_invoker = var.allow_public_invoker" in main
    assert "@sha256:[0-9a-f]{64}$" in variables


def test_cloud_run_module_resolves_secret_versions_without_plaintext_values() -> None:
    main = CLOUD_RUN_MAIN.read_text(encoding="utf-8")
    variables = CLOUD_RUN_VARIABLES.read_text(encoding="utf-8")

    assert 'dynamic "env"' in main
    assert "value_source" in main
    assert "secret_key_ref" in main
    assert "secret_environment_variables" in variables
    assert 'version = optional(string, "latest")' in variables


def test_runtime_identity_is_limited_to_consumed_secret_containers() -> None:
    main = STAGING_MAIN.read_text(encoding="utf-8")
    runtime_secret_section = main.split("runtime_secret_ids = toset([", maxsplit=1)[1]
    runtime_secret_block = runtime_secret_section.split("])", maxsplit=1)[0]

    assert '"cdl-database-url"' in runtime_secret_block
    assert '"cdl-development-login-secret"' in runtime_secret_block
    assert '"cdl-session-cookie-secret"' not in runtime_secret_block


def test_database_jobs_are_separate_guarded_terraform_resources() -> None:
    content = DATABASE_JOBS.read_text(encoding="utf-8")

    for phrase in [
        'resource "google_cloud_run_v2_job" "database_migration"',
        'resource "google_cloud_run_v2_job" "synthetic_seed"',
        "var.enable_database_jobs ? 1 : 0",
        'args    = ["-m", "cdl_api.migrate"]',
        'args    = ["-m", "cdl_api.seed_staging"]',
        'value = "true"',
        "google_service_account.migration.email",
        'module.runtime_secrets.secret_names["cdl-database-url"]',
        "max_retries     = 0",
        'timeout         = "900s"',
        "deletion_protection = true",
    ]:
        assert phrase in content

    assert "cdl-development-login-secret" not in content


def test_image_workflow_builds_an_immutable_reference_without_deploying() -> None:
    content = IMAGE_WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        "GCP Build Staging Image",
        "confirm_foundation_applied",
        "github.ref == 'refs/heads/main'",
        "docker build --pull",
        "docker push",
        "gcloud artifacts docker images describe",
        "image_digest_uri=",
        "actions/upload-artifact@v4",
    ]:
        assert phrase in content

    assert "deploy-cloudrun" not in content
    assert "gcloud run deploy" not in content
    assert "CDL_REPOSITORY_MODE=memory" not in content


def test_plan_workflow_uses_cumulative_private_stages() -> None:
    content = PLAN_WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        "deployment_stage:",
        "foundation",
        "database-jobs",
        "runtime",
        "backend_image must be an immutable @sha256 digest URI",
        '-var="enable_database_jobs=${ENABLE_DATABASE_JOBS}"',
        '-var="enable_cloud_run=${ENABLE_CLOUD_RUN}"',
        '-var="backend_image=${BACKEND_IMAGE}"',
        '-var="allow_public_invoker=false"',
    ]:
        assert phrase in content

    dispatch_section = content.split("workflow_dispatch:", maxsplit=1)[1]
    dispatch_inputs = dispatch_section.split("permissions:", maxsplit=1)[0]
    assert "allow_public_invoker:" not in dispatch_inputs


def test_database_job_execution_is_manual_and_confirmation_gated() -> None:
    content = DATABASE_JOB_WORKFLOW.read_text(encoding="utf-8")

    for phrase in [
        "workflow_dispatch:",
        "confirm_database_jobs_applied",
        "confirm_synthetic_data",
        "github.ref == 'refs/heads/main'",
        "gcloud run jobs describe",
        "gcloud run jobs execute",
        "--wait",
        "@sha256:[0-9a-f]{64}$",
    ]:
        assert phrase in content

    assert "schedule:" not in content
    assert "--execute-now" not in content


def test_database_credential_bootstrap_is_manual_restricted_and_secret_safe() -> None:
    content = DATABASE_CREDENTIAL_WORKFLOW.read_text(encoding="utf-8")
    dispatch_section = content.split("workflow_dispatch:", maxsplit=1)[1]
    dispatch_inputs = dispatch_section.split("permissions:", maxsplit=1)[0]

    for phrase in [
        "GCP Bootstrap Staging Database Credential",
        "confirm_foundation_applied",
        "ROTATE STAGING DATABASE CREDENTIAL",
        "github.ref == 'refs/heads/main'",
        'test "${PROJECT_ID}" = "cdl-react-staging-ast"',
        "google-github-actions/auth@v3",
        "CLOUD_SQL_PROXY_SHA256",
        "sha256sum --check",
        "REVOKE cloudsqlsuperuser FROM cdl_app",
        "NOSUPERUSER",
        "NOCREATEDB",
        "NOCREATEROLE",
        "NOREPLICATION",
        "NOBYPASSRLS",
        "REVOKE ALL ON DATABASE cdl_react FROM PUBLIC",
        "GRANT CONNECT ON DATABASE cdl_react TO cdl_app",
        "REVOKE CREATE ON SCHEMA public FROM PUBLIC",
        "gcloud secrets versions add",
        "--data-file=-",
        "rotated and discarded on workflow exit",
    ]:
        assert phrase in content

    assert "password:" not in dispatch_inputs
    assert "database_url:" not in dispatch_inputs
    assert "actions/upload-artifact" not in content
    assert "cdl-react-prod" not in content


def test_adr_keeps_apply_migrations_and_public_access_separately_gated() -> None:
    content = ADR.read_text(encoding="utf-8")

    for phrase in [
        "one Cloud Run service",
        "Live provisioning and public exposure remain separately gated",
        "Secret payloads will not be stored in Terraform state",
        "Run Alembic and deterministic synthetic seed jobs",
        "Migration and seed execution must remain controlled jobs",
    ]:
        assert phrase in content
