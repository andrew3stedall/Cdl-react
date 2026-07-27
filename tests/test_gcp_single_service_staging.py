from pathlib import Path

DOCKERFILE = Path("Dockerfile")
STAGING_MAIN = Path("infra/terraform/environments/staging/main.tf")
STAGING_VARIABLES = Path("infra/terraform/environments/staging/variables.tf")
CLOUD_RUN_MAIN = Path("infra/terraform/modules/cloud-run-api/main.tf")
CLOUD_RUN_VARIABLES = Path("infra/terraform/modules/cloud-run-api/variables.tf")
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

    assert 'default     = false' in variables
    assert 'default     = "postgres"' in variables
    assert "repository_mode               = var.runtime_repository_mode" in main
    assert "CDL_DATABASE_URL" in main
    assert "CDL_DEVELOPMENT_LOGIN_SECRET" in main
    assert 'CDL_SESSION_COOKIE_SECURE = "true"' in main
    assert "allow_public_invoker = var.allow_public_invoker" in main


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
    runtime_secret_block = main.split("runtime_secret_ids = toset([", maxsplit=1)[1].split(
        "])", maxsplit=1
    )[0]

    assert '"cdl-database-url"' in runtime_secret_block
    assert '"cdl-development-login-secret"' in runtime_secret_block
    assert '"cdl-session-cookie-secret"' not in runtime_secret_block


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
