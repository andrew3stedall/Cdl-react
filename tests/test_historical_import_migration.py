import os

import pytest
from sqlalchemy import create_engine, inspect

from cdl_api.repositories.postgres_imports import HISTORICAL_IMPORT_PERSISTENCE_TABLES

EXPECTED_COLUMNS = {"id", "payload_json", "created_at"}
EXPECTED_TABLES = {
    "import_batches",
    "import_source_mappings",
    "import_source_payloads",
    "import_review_items",
    "import_conflicts",
}


def test_historical_import_metadata_matches_migration_0008() -> None:
    assert {table.name for table in HISTORICAL_IMPORT_PERSISTENCE_TABLES} == EXPECTED_TABLES
    for table in HISTORICAL_IMPORT_PERSISTENCE_TABLES:
        assert set(table.c.keys()) == EXPECTED_COLUMNS


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_has_historical_import_payload_tables() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    inspector = inspect(engine)

    assert EXPECTED_TABLES <= set(inspector.get_table_names())
    for table_name in EXPECTED_TABLES:
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        assert columns == EXPECTED_COLUMNS
