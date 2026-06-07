from pathlib import Path

FEATURE_PATH = Path("docs/features/active/production-backend-database-and-gcp-infrastructure.md")
WIKI_PATH = Path("docs/wiki/production-backend-database-and-gcp-infrastructure.md")


def read_feature() -> str:
    return FEATURE_PATH.read_text(encoding="utf-8")


def read_wiki() -> str:
    return WIKI_PATH.read_text(encoding="utf-8")


def test_primary_platform_decisions_are_documented() -> None:
    content = read_feature()

    for decision in [
        "Cloud SQL for PostgreSQL",
        "Cloud Run service for the FastAPI container",
        "Firebase Hosting or Cloud Storage plus Cloud CDN",
        "Secret Manager",
        "Alembic-managed schema migrations",
        "Terraform/OpenTofu-style declarative configuration",
    ]:
        assert decision in content


def test_environment_strategy_is_documented() -> None:
    content = read_feature()

    for environment in ["Local", "Preview", "Staging", "Production"]:
        assert f"| {environment} |" in content

    assert "separate connection strings and service accounts" in content
    assert "staging restore drill" in content


def test_schema_domains_are_mapped_to_persistence_waves() -> None:
    content = read_feature()

    for domain in [
        "Identity and auth",
        "Preferences",
        "League structure",
        "FPL reference cache",
        "Squad rights",
        "Transfers and trades",
        "Team selection",
        "Fixtures and scoring",
        "Rules and policy",
        "Dashboard and FDR",
        "Legacy migration",
    ]:
        assert domain in content

    for wave in ["Wave 1", "Wave 2", "Wave 3", "Wave 4", "Wave 5", "Wave 6"]:
        assert wave in content


def test_follow_up_issue_register_is_visible() -> None:
    content = read_feature()

    for draft_issue in [
        "Database architecture decision record",
        "Local and CI PostgreSQL foundation",
        "Backend database settings and repository factory",
        "Auth/session/preference persistence",
        "Core league and FPL cache schema",
        "Squad, transfers, and trades persistence",
        "Team-selection and chip persistence",
        "Fixture, scoring, table, and knockout persistence",
        "Dashboard and FDR production data",
        "Legacy import and backfill tooling",
        "GCP infrastructure bootstrap",
        "Production deployment and go-live checklist",
    ]:
        assert draft_issue in content

    assert "Acceptance gate" in content


def test_wiki_summarises_architecture_and_operational_gates() -> None:
    content = read_wiki()

    for phrase in [
        "Cloud SQL for PostgreSQL",
        "FastAPI container on Cloud Run",
        "Secret Manager",
        "Local, preview, staging, production",
        "Automated Cloud SQL backups and point-in-time recovery",
        "Cloud Run scaling limits sized against Cloud SQL connection capacity",
        "Do not treat this planning document as proof that any GCP resource or production database has been provisioned.",
    ]:
        assert phrase in content
