"""Adapter for one concrete, explicitly synthetic head-to-head export shape."""

from typing import Any

from pydantic import BaseModel, Field

from cdl_api.contracts.domain import TeamSummary
from cdl_api.contracts.imports import HistoricalImportBatch


class SyntheticHeadToHeadExportRow(BaseModel):
    record_key: str
    target_record_id: str
    team: TeamSummary
    opponent: TeamSummary
    fixture_source_keys: list[str]
    target_fixture_ids: list[str]
    played: int = Field(ge=0)
    wins: int = Field(ge=0)
    draws: int = Field(ge=0)
    losses: int = Field(ge=0)
    points_for: int = Field(ge=0)
    points_against: int = Field(ge=0)


class SyntheticHeadToHeadExportDocument(BaseModel):
    export_version: str
    batch_id: str
    source_system: str
    rows: list[SyntheticHeadToHeadExportRow]


class SyntheticHeadToHeadAdapterResult(BaseModel):
    batch: HistoricalImportBatch
    mapping_diagnostics: list[str] = Field(default_factory=list)
    review_diagnostics: list[str] = Field(default_factory=list)


class SyntheticHeadToHeadExportAdapter:
    """Normalize the supported synthetic matchup export into historical-import/v1."""

    SUPPORTED_EXPORT_VERSION = "synthetic-head-to-head-export/v1"

    def adapt(self, payload: dict[str, Any]) -> SyntheticHeadToHeadAdapterResult:
        document = SyntheticHeadToHeadExportDocument.model_validate(payload)
        if document.export_version != self.SUPPORTED_EXPORT_VERSION:
            raise ValueError("Unsupported synthetic head-to-head export version.")

        mappings: dict[str, str] = {}
        records: list[dict[str, Any]] = []
        diagnostics: list[str] = []
        reviews: list[str] = []
        seen_records: set[str] = set()

        for row in document.rows:
            if row.record_key in seen_records:
                reviews.append(f"duplicate head-to-head key: {row.record_key}")
                continue
            seen_records.add(row.record_key)
            if len(row.fixture_source_keys) != len(row.target_fixture_ids):
                raise ValueError("Head-to-head fixture mapping lists must have equal length.")
            if row.played != row.wins + row.draws + row.losses:
                raise ValueError("Head-to-head played must equal wins plus draws plus losses.")

            row_mappings = {row.record_key: row.target_record_id}
            fixture_mappings = zip(
                row.fixture_source_keys,
                row.target_fixture_ids,
                strict=True,
            )
            row_mappings.update(dict(fixture_mappings))
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
                    "source_record_id": row.record_key,
                    "mapping_key": row.record_key,
                    "entity_type": "head_to_head_record",
                    "payload": {
                        "team": row.team.model_dump(mode="json"),
                        "opponent": row.opponent.model_dump(mode="json"),
                        "fixture_source_keys": row.fixture_source_keys,
                        "played": row.played,
                        "wins": row.wins,
                        "draws": row.draws,
                        "losses": row.losses,
                        "points_for": row.points_for,
                        "points_against": row.points_against,
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
        return SyntheticHeadToHeadAdapterResult(
            batch=batch,
            mapping_diagnostics=diagnostics,
            review_diagnostics=reviews,
        )
