"""Adapter for one concrete, explicitly synthetic scoring-snapshot export shape."""

from typing import Any

from pydantic import BaseModel, Field

from cdl_api.contracts.imports import HistoricalImportBatch


class SyntheticScoringExportRow(BaseModel):
    snapshot_key: str
    fixture_key: str
    target_fixture_id: str
    bonus_points: dict[str, int] = Field(default_factory=dict)
    chips_played: dict[str, str] = Field(default_factory=dict)
    epl_fixture_ids: list[str] = Field(default_factory=list)


class SyntheticScoringExportDocument(BaseModel):
    export_version: str
    batch_id: str
    source_system: str
    rows: list[SyntheticScoringExportRow]


class SyntheticScoringAdapterResult(BaseModel):
    batch: HistoricalImportBatch
    mapping_diagnostics: list[str] = Field(default_factory=list)
    review_diagnostics: list[str] = Field(default_factory=list)


class SyntheticScoringExportAdapter:
    """Normalize the supported synthetic scoring export into historical-import/v1."""

    SUPPORTED_EXPORT_VERSION = "synthetic-scoring-export/v1"

    def adapt(self, payload: dict[str, Any]) -> SyntheticScoringAdapterResult:
        document = SyntheticScoringExportDocument.model_validate(payload)
        if document.export_version != self.SUPPORTED_EXPORT_VERSION:
            raise ValueError("Unsupported synthetic scoring export version.")

        mappings: list[dict[str, str]] = []
        records: list[dict[str, Any]] = []
        mapping_diagnostics: list[str] = []
        review_diagnostics: list[str] = []
        seen_snapshot_keys: set[str] = set()
        seen_fixture_keys: set[str] = set()

        for row in document.rows:
            if row.snapshot_key in seen_snapshot_keys:
                review_diagnostics.append(f"duplicate scoring snapshot key: {row.snapshot_key}")
                continue
            seen_snapshot_keys.add(row.snapshot_key)
            if row.fixture_key not in seen_fixture_keys:
                seen_fixture_keys.add(row.fixture_key)
                mappings.append(
                    {
                        "source_key": row.fixture_key,
                        "target_id": row.target_fixture_id,
                    }
                )
                mapping_diagnostics.append(f"{row.fixture_key} -> {row.target_fixture_id}")
            records.append(
                {
                    "source_record_id": row.snapshot_key,
                    "mapping_key": row.fixture_key,
                    "entity_type": "cdl_scoring_snapshot",
                    "payload": {
                        "bonus_points": row.bonus_points,
                        "chips_played": row.chips_played,
                        "epl_fixture_ids": row.epl_fixture_ids,
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
        return SyntheticScoringAdapterResult(
            batch=batch,
            mapping_diagnostics=mapping_diagnostics,
            review_diagnostics=review_diagnostics,
        )
