"""Adapter for one concrete, explicitly synthetic EPL fixture-context export shape."""

from typing import Any

from pydantic import BaseModel, Field

from cdl_api.contracts.domain import TeamSummary
from cdl_api.contracts.imports import HistoricalImportBatch


class SyntheticEplContextExportRow(BaseModel):
    context_key: str
    target_epl_fixture_id: str
    scoring_snapshot_id: str
    gameweek: int = Field(ge=1, le=38)
    home_team: TeamSummary
    away_team: TeamSummary
    status: str
    kickoff_label: str


class SyntheticEplContextExportDocument(BaseModel):
    export_version: str
    batch_id: str
    source_system: str
    rows: list[SyntheticEplContextExportRow]


class SyntheticEplContextAdapterResult(BaseModel):
    batch: HistoricalImportBatch
    mapping_diagnostics: list[str] = Field(default_factory=list)
    review_diagnostics: list[str] = Field(default_factory=list)


class SyntheticEplContextExportAdapter:
    """Normalize the supported synthetic EPL context export into historical-import/v1."""

    SUPPORTED_EXPORT_VERSION = "synthetic-epl-context-export/v1"

    def adapt(self, payload: dict[str, Any]) -> SyntheticEplContextAdapterResult:
        document = SyntheticEplContextExportDocument.model_validate(payload)
        if document.export_version != self.SUPPORTED_EXPORT_VERSION:
            raise ValueError("Unsupported synthetic EPL context export version.")

        mappings: list[dict[str, str]] = []
        records: list[dict[str, Any]] = []
        mapping_diagnostics: list[str] = []
        review_diagnostics: list[str] = []
        seen_context_keys: set[str] = set()

        for row in document.rows:
            if row.context_key in seen_context_keys:
                review_diagnostics.append(f"duplicate EPL context key: {row.context_key}")
                continue
            seen_context_keys.add(row.context_key)
            mappings.append(
                {
                    "source_key": row.context_key,
                    "target_id": row.target_epl_fixture_id,
                }
            )
            mapping_diagnostics.append(f"{row.context_key} -> {row.target_epl_fixture_id}")
            records.append(
                {
                    "source_record_id": row.context_key,
                    "mapping_key": row.context_key,
                    "entity_type": "epl_fixture_context",
                    "payload": {
                        "scoring_snapshot_id": row.scoring_snapshot_id,
                        "gameweek": row.gameweek,
                        "home_team": row.home_team.model_dump(mode="json"),
                        "away_team": row.away_team.model_dump(mode="json"),
                        "status": row.status,
                        "kickoff_label": row.kickoff_label,
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
        return SyntheticEplContextAdapterResult(
            batch=batch,
            mapping_diagnostics=mapping_diagnostics,
            review_diagnostics=review_diagnostics,
        )
