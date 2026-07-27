import os

import pytest
from sqlalchemy import create_engine, inspect

IMPORT_TABLES = {
    "historical_import_batches",
    "historical_source_payloads",
    "historical_source_mappings",
    "historical_import_review_items",
    "historical_import_conflicts",
}


@pytest.mark.skipif(
    not os.getenv("CDL_DATABASE_URL", "").startswith("postgresql"),
    reason="requires the migrated PostgreSQL CI service",
)
def test_clean_postgres_has_historical_import_foundation() -> None:
    engine = create_engine(os.environ["CDL_DATABASE_URL"])
    inspector = inspect(engine)

    assert IMPORT_TABLES <= set(inspector.get_table_names())

    batch_uniques = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints(
            "historical_import_batches"
        )
    }
    payload_uniques = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints(
            "historical_source_payloads"
        )
    }
    mapping_uniques = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints(
            "historical_source_mappings"
        )
    }

    assert "uq_import_batch_source_contract" in batch_uniques
    assert "uq_source_payload_identity" in payload_uniques
    assert "uq_source_mapping_identity" in mapping_uniques

    payload_foreign_keys = inspector.get_foreign_keys(
        "historical_source_payloads"
    )
    mapping_foreign_keys = inspector.get_foreign_keys(
        "historical_source_mappings"
    )
    assert {
        foreign_key["referred_table"] for foreign_key in payload_foreign_keys
    } == {"historical_import_batches"}
    assert {
        foreign_key["referred_table"] for foreign_key in mapping_foreign_keys
    } == {"historical_import_batches"}
