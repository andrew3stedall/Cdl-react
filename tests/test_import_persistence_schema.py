from cdl_api.repositories.postgres_imports import HISTORICAL_IMPORT_PERSISTENCE_TABLES


def test_import_persistence_tables_are_defined() -> None:
    assert len(HISTORICAL_IMPORT_PERSISTENCE_TABLES) == 5
