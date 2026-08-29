from pathlib import Path

from cdl_api.repositories.postgres_team_selection import TEAM_SELECTION_PERSISTENCE_TABLES


def test_team_selection_persistence_tables_exist() -> None:
    assert {table.name for table in TEAM_SELECTION_PERSISTENCE_TABLES} == {
        "team_selection_lineup_slots",
        "team_selection_chips",
        "team_selection_fixture_locks",
        "team_selection_audit_events",
    }


def test_deadline_lock_migration_scopes_locks_to_each_draft_team() -> None:
    content = Path("migrations/versions/0022_team_selection_lock_owner.py").read_text(
        encoding="utf-8"
    )

    assert 'down_revision: str | None = "0021_player_custom_palettes"' in content
    assert '"draft_team_id"' in content
    assert '"ix_team_selection_fixture_locks_scope"' in content
