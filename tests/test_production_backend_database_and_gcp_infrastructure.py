from pathlib import Path

FEATURE_PATH = (
    Path("docs/features/completed/minor/v0.1.0")
    / "production-backend-database-and-gcp-infrastructure.md"
)
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

    assert "least-privilege IAM" in content
    assert "staging restore drill" in content


def test_schema_domains_are_mapped_to_persistence_waves() -> None:
    content = read_feature()

    for domain in [
        "Users",
        "Leagues",
        "Squad ownership",
        "Lineups",
        "CDL fixtures",
        "Dashboard definitions",
        "source ID mappings",
    ]:
        assert domain in content

    for wave in ["Wave 1", "Wave 2", "Wave 3", "Wave 4", "Wave 5", "Wave 6"]:
        assert wave in content


def test_follow_up_issue_register_is_visible() -> None:
    content = read_feature()

    for issue_reference in [
        "#60",
        "#61",
        "#62",
        "#63",
        "#64",
        "#65",
        "#66",
        "#67",
        "#68",
        "#69",
        "#70",
        "#71",
    ]:
        assert issue_reference in content

    assert "Remaining Implementation Work" in content


def test_wiki_summarises_architecture_and_operational_gates() -> None:
    content = read_wiki()

    for phrase in [
        "Cloud SQL for PostgreSQL",
        "FastAPI container on Cloud Run",
        "Secret Manager",
        "Local, preview, staging, production",
        "Automated Cloud SQL backups and point-in-time recovery",
        "Cloud Run scaling limits sized against Cloud SQL connection capacity",
        (
            "Do not treat this planning document as proof that any GCP resource "
            "or production database has been provisioned."
        ),
    ]:
        assert phrase in content


def test_completed_planning_feature_links_release_and_pr() -> None:
    content = read_feature()

    assert "Planning issue: #58" in content
    assert "Merged PR: #59" in content
    assert "docs/releases/v0.1.0.md" in content
    assert "Production database and GCP implementation is not complete" in content
