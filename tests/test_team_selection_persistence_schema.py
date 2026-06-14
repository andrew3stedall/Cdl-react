from cdl_api.repositories.postgres_team_selection import TEAM_SELECTION_PERSISTENCE_TABLES


def test_team_selection_persistence_tables_exist() -> None:
    assert {table.name for table in TEAM_SELECTION_PERSISTENCE_TABLES} == {
        "team_selection_lineup_slots",
        "team_selection_chips",
        "team_selection_fixture_locks",
        "team_selection_audit_events",
    }
