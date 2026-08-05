from pathlib import Path

from cdl_api.repositories.postgres_fpl_data import FPL_INGESTION_TABLES

MIGRATION_PATH = Path("migrations/versions/0009_fpl_ingestion.py")
EXPECTED_TABLES = {
    "fpl_gameweeks",
    "fpl_fixtures",
    "external_payload_cache",
    "external_fetch_log",
}


def test_fpl_ingestion_metadata_lists_expected_tables() -> None:
    assert {table.name for table in FPL_INGESTION_TABLES} == EXPECTED_TABLES


def test_fpl_ingestion_migration_extends_historical_import_head() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")

    assert "Revision ID: 0009_fpl_ingestion" in content
    assert "Revises: 0008_import_tooling" in content
    assert 'down_revision: str | None = "0008_import_tooling"' in content
    for table_name in EXPECTED_TABLES:
        assert f'"{table_name}"' in content
