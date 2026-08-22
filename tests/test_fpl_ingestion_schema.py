from pathlib import Path

from cdl_api.repositories.postgres_fpl_data import FPL_INGESTION_TABLES

BASE_MIGRATION_PATH = Path("migrations/versions/0009_fpl_ingestion.py")
METRICS_MIGRATION_PATH = Path("migrations/versions/0010_fpl_player_metrics.py")
PROVISIONAL_MIGRATION_PATH = Path("migrations/versions/0014_fpl_provisional_fixture_state.py")
EXPECTED_TABLES = {
    "fpl_gameweeks",
    "fpl_fixtures",
    "fpl_player_current_metrics",
    "external_payload_cache",
    "external_fetch_log",
}


def test_fpl_ingestion_metadata_lists_expected_tables() -> None:
    assert {table.name for table in FPL_INGESTION_TABLES} == EXPECTED_TABLES


def test_fpl_ingestion_migrations_extend_historical_import_head() -> None:
    base_content = BASE_MIGRATION_PATH.read_text(encoding="utf-8")
    metrics_content = METRICS_MIGRATION_PATH.read_text(encoding="utf-8")

    assert "Revision ID: 0009_fpl_ingestion" in base_content
    assert "Revises: 0008_import_tooling" in base_content
    assert 'down_revision: str | None = "0008_import_tooling"' in base_content
    for table_name in EXPECTED_TABLES - {"fpl_player_current_metrics"}:
        assert f'"{table_name}"' in base_content

    assert "Revision ID: 0010_fpl_player_metrics" in metrics_content
    assert "Revises: 0009_fpl_ingestion" in metrics_content
    assert 'down_revision: str | None = "0009_fpl_ingestion"' in metrics_content
    assert '"fpl_player_current_metrics"' in metrics_content

    provisional_content = PROVISIONAL_MIGRATION_PATH.read_text(encoding="utf-8")
    assert "Revision ID: 0014_fpl_provisional_fixture" in provisional_content
    assert 'down_revision: str | None = "0013_fdr_display_mode"' in provisional_content
    assert '"finished_provisional"' in provisional_content
