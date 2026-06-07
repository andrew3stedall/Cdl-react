from pathlib import Path

FEATURE_PATH = Path(
    "docs/features/active/"
    "database-architecture-decision-record-for-production-persistence.md"
)
ADR_PATH = Path("docs/architecture/production-persistence-adr.md")
WIKI_PATH = Path("docs/wiki/production-backend-database-and-gcp-infrastructure.md")


def read_feature() -> str:
    return FEATURE_PATH.read_text(encoding="utf-8")


def read_adr() -> str:
    return ADR_PATH.read_text(encoding="utf-8")


def read_wiki() -> str:
    return WIKI_PATH.read_text(encoding="utf-8")


def test_issue_60_feature_documents_database_decisions() -> None:
    content = read_feature()

    for phrase in [
        "Cloud SQL for PostgreSQL",
        "Alembic-managed schema migrations",
        "settings-driven repository factory",
        "Local",
        "CI",
        "Staging",
        "Production",
        "Deferred Alternatives",
        "#78 GCP milestone remains blocked",
    ]:
        assert phrase in content


def test_adr_confirms_repository_factory_and_migration_model() -> None:
    content = read_adr()

    for phrase in [
        "Accepted for first production implementation",
        "Use **Cloud SQL for PostgreSQL**",
        "Use **Alembic-managed schema migrations**",
        "Use a **settings-driven repository factory**",
        "migration smoke test",
        "Schema migrations and historical import jobs must remain separate",
    ]:
        assert phrase in content


def test_adr_lists_deferred_alternatives() -> None:
    content = read_adr()

    for alternative in [
        "Firestore",
        "AlloyDB",
        "Spanner",
        "BigQuery-first storage",
        "SQLite-only workflow",
        "Manual SQL changes",
    ]:
        assert alternative in content


def test_wiki_links_adr_and_gcp_gate() -> None:
    content = read_wiki()

    assert "docs/architecture/production-persistence-adr.md" in content
    assert "Coordinator issue #75" in content
    assert "Milestone issue #78 must not start" in content
    assert "docs/runbooks/gcp-bootstrap-setup.md" in content
