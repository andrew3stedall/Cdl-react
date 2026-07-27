"""Adapter for one concrete, explicitly synthetic knockout export shape."""

from typing import Any

from pydantic import BaseModel, Field

from cdl_api.contracts.domain import TeamSummary
from cdl_api.contracts.imports import HistoricalImportBatch


class SyntheticKnockoutExportRow(BaseModel):
    match_key: str
    target_match_id: str
    fixture_source_key: str
    target_fixture_id: str
    round_label: str
    rounds: list[str]
    winner: TeamSummary | None = None


class SyntheticKnockoutExportDocument(BaseModel):
    export_version: str
    batch_id: str
    source_system: str
    rows: list[SyntheticKnockoutExportRow]


class SyntheticKnockoutAdapterResult(BaseModel):
    batch: HistoricalImportBatch
    mapping_diagnostics: list[str] = Field(default_factory=list)
    review_diagnostics: list[str] = Field(default_factory=list)


class SyntheticKnockoutExportAdapter:
    """Normalize the supported synthetic knockout export into historical-import/v1."""

    SUPPORTED_EXPORT_VERSION = "synthetic-knockout-export/v1"

    def adapt(self, payload: dict[str, Any]) -> SyntheticKnockoutAdapterResult:
        document = SyntheticKnockoutExportDocument.model_validate(payload)
        if document.export_version != self.SUPPORTED_EXPORT_VERSION:
            raise ValueError("Unsupported synthetic knockout export version.")

        mappings: dict[str, str] = {}
        records: list[dict[str, Any]] = []
        diagnostics: list[str] = []
        reviews: list[str] = []
        seen_matches: set[str] = set()

        for row in document.rows:
            if row.match_key in seen_matches:
                reviews.append(f"duplicate knockout match key: {row.match_key}")
                continue
            seen_matches.add(row.match_key)
            if row.round_label not in row.rounds:
                raise ValueError("Knockout round label must be present in rounds.")

            row_mappings = {
                row.match_key: row.target_match_id,
                row.fixture_source_key: row.target_fixture_id,
            }
            for source_key, target_id in row_mappings.items():
                existing = mappings.get(source_key)
                if existing is not None and existing != target_id:
                    reviews.append(f"conflicting adapter mapping: {source_key}")
                    continue
                if existing is None:
                    mappings[source_key] = target_id
                    diagnostics.append(f"{source_key} -> {target_id}")

            records.append(
                {
                    "source_record_id": row.match_key,
                    "mapping_key": row.match_key,
                    "entity_type": "knockout_match",
                    "payload": {
                        "fixture_source_key": row.fixture_source_key,
                        "round_label": row.round_label,
                        "rounds": row.rounds,
                        "winner": (
                            row.winner.model_dump(mode="json") if row.winner is not None else None
                        ),
                    },
                }
            )

        batch = HistoricalImportBatch.model_validate(
            {
                "contract_version": "historical-import/v1",
                "batch_id": document.batch_id,
                "source_system": document.source_system,
                "synthetic": True,
                "mappings": [
                    {"source_key": source_key, "target_id": target_id}
                    for source_key, target_id in sorted(mappings.items())
                ],
                "records": records,
            }
        )
        return SyntheticKnockoutAdapterResult(
            batch=batch,
            mapping_diagnostics=diagnostics,
            review_diagnostics=reviews,
        )
