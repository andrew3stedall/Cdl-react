from pathlib import Path

FEATURE_PATH = Path("docs/features/active/persist-auth-sessions-and-user-preferences.md")
WIKI_PATH = Path("docs/wiki/auth-session-preference-postgresql-persistence.md")
MIGRATION_PATH = Path("migrations/versions/0002_auth_preferences.py")


def test_issue_63_feature_documents_scope_and_gate() -> None:
    content = FEATURE_PATH.read_text(encoding="utf-8")

    for phrase in [
        "Active implementation feature for issue #63",
        "Parent coordinator: #75",
        "Parent milestone: #77",
        "Depends on: #76",
        "PostgreSQL-backed repositories",
        "#78 remains blocked",
    ]:
        assert phrase in content


def test_auth_persistence_wiki_documents_tables_and_handoff() -> None:
    content = WIKI_PATH.read_text(encoding="utf-8")

    for phrase in [
        "0002_auth_preferences",
        "users",
        "sessions",
        "user_preferences",
        "CDL_REPOSITORY_MODE=postgres",
        "#64 can add league and FPL cache schema",
        "#78, #70, and #71 remain blocked",
    ]:
        assert phrase in content


def test_auth_persistence_migration_is_append_only() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")

    assert "Revision ID: 0002_auth_preferences" in content
    assert "Revises: 0001_create_migration_probe" in content
    assert "users" in content
    assert "sessions" in content
    assert "user_preferences" in content
