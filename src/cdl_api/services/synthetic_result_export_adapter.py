"""Adapter for one concrete, explicitly synthetic fixture-result export shape."""

from typing import Any

from pydantic import BaseModel, Field

from cdl_api.contracts.imports import HistoricalImportBatch


class SyntheticResultExportRow(BaseModel):
    result_key: str
    fixture_key: str
    target_fixture_id: str
    home_score: int = Field(ge=0)
    away_score: int = Field(ge=0)
    outcome: str


class SyntheticResultExportDocument(BaseModel):
    export_version: str
    batch_id: str
    source_system: str
    rows: list[SyntheticResultExportRow]


class SyntheticResultAdapterResult(BaseModel):
    batch: HistoricalImportBatch
    mapping_diagnostics: list[str] = Field(default_factory=list)
    review_diagnostics: list[str] = Field(default_factory=list)


class SyntheticResultExportAdapter:
    """Normalize the supported synthetic result export into historical-import/v1."""

    SUPPORTED_EXPORT_VERSION = "synthetic-result-export/v1"

    def adapt(self, payload: dict[str, Any]) -> SyntheticResultAdapterResult:
        document = SyntheticResultExportDocument.model_validate(payload)
        if document.export_version != self.SUPPORTED_EXPORT_VERSION:
            raise ValueError("Unsupported synthetic result export version.")

        mappings: list[dict[str, str]] = []
        records: list[dict[str, Any]] = []
        mapping_diagnostics: list[str] = []
        review_diagnostics: list[str] = []
        seen_result_keys: set[str] = set()
        seen_fixture_keys: set[str] = set()

        for row in document.rows:
            if row.result_key in seen_result_keys:
                review_diagnostics.append(f"duplicate result key: {row.result_key}")
                continue
            seen_result_keys.add(row.result_key)
            if row.fixture_key not in seen_fixture_keys:
                seen_fixture_keys.add(row.fixture_key)
                mappings.append({"source_key": row.fixture_key, "target_id": row.target_fixture_id})
                mapping_diagnostics.append(f"{row.fixture_key} -> {row.target_fixture_id}")
            records.append(
                {
                    "source_record_id": row.result_key,
                    "mapping_key": row.fixture_key,
                    "entity_type": "cdl_result",
                    "payload": {
                        "home_score": row.home_score,
                        "away_score": row.away_score,
                        "outcome": row.outcome,
                    },
                }
            )

        batch = HistoricalImportBatch.model_validate(
            {
                "contract_version": "historical-import/v1",
                "batch_id": document.batch_id,
                "source_system": document.source_system,
                "synthetic": True,
                "mappings": mappings,
                "records": records,
            }
        )
        return SyntheticResultAdapterResult(
            batch=batch,
            mapping_diagnostics=mapping_diagnostics,
            review_diagnostics=review_diagnostics,
        )
