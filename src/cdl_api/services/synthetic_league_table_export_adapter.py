"""Adapter for one concrete, explicitly synthetic league-table export shape."""

from typing import Any

from pydantic import BaseModel, Field

from cdl_api.contracts.domain import TeamSummary
from cdl_api.contracts.imports import HistoricalImportBatch
from cdl_api.contracts.league_models import LeagueTableRow


class SyntheticLeagueTableSnapshotExportRow(BaseModel):
    snapshot_key: str
    target_snapshot_id: str
    gameweek_id: str
    fixture_source_keys: list[str]
    target_fixture_ids: list[str]
    rows: list[LeagueTableRow]


class SyntheticLeagueTableSnapshotExportDocument(BaseModel):
    export_version: str
    batch_id: str
    source_system: str
    rows: list[SyntheticLeagueTableSnapshotExportRow]


class SyntheticLeagueTableSnapshotAdapterResult(BaseModel):
    batch: HistoricalImportBatch
    mapping_diagnostics: list[str] = Field(default_factory=list)
    review_diagnostics: list[str] = Field(default_factory=list)


class SyntheticLeagueTableSnapshotExportAdapter:
    """Normalize the supported synthetic table export into historical-import/v1."""

    SUPPORTED_EXPORT_VERSION = "synthetic-league-table-export/v1"

    def adapt(self, payload: dict[str, Any]) -> SyntheticLeagueTableSnapshotAdapterResult:
        document = SyntheticLeagueTableSnapshotExportDocument.model_validate(payload)
        if document.export_version != self.SUPPORTED_EXPORT_VERSION:
            raise ValueError("Unsupported synthetic league-table export version.")

        mappings: dict[str, str] = {}
        records: list[dict[str, Any]] = []
        diagnostics: list[str] = []
        reviews: list[str] = []
        seen_snapshots: set[str] = set()

        for row in document.rows:
            if row.snapshot_key in seen_snapshots:
                reviews.append(f"duplicate league-table snapshot key: {row.snapshot_key}")
                continue
            seen_snapshots.add(row.snapshot_key)
            if len(row.fixture_source_keys) != len(row.target_fixture_ids):
                raise ValueError("League-table fixture mapping lists must have equal length.")

            row_mappings = {
                row.snapshot_key: row.target_snapshot_id,
                **dict(zip(row.fixture_source_keys, row.target_fixture_ids, strict=True)),
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
                    "source_record_id": row.snapshot_key,
                    "mapping_key": row.snapshot_key,
                    "entity_type": "league_table_snapshot",
                    "payload": {
                        "gameweek_id": row.gameweek_id,
                        "fixture_source_keys": row.fixture_source_keys,
                        "rows": [entry.model_dump(mode="json") for entry in row.rows],
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
        return SyntheticLeagueTableSnapshotAdapterResult(
            batch=batch,
            mapping_diagnostics=diagnostics,
            review_diagnostics=reviews,
        )
