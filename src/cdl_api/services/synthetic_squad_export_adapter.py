"""Adapter for one concrete, explicitly synthetic squad-membership export shape."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from cdl_api.contracts.imports import HistoricalImportBatch


class SyntheticSquadMembershipExportRow(BaseModel):
    membership_key: str
    target_ownership_id: str
    season_id: str
    team_source_key: str
    target_team_id: str
    player_source_key: str
    target_player_id: str
    started_at: datetime


class SyntheticSquadMembershipExportDocument(BaseModel):
    export_version: str
    batch_id: str
    source_system: str
    rows: list[SyntheticSquadMembershipExportRow]


class SyntheticSquadMembershipAdapterResult(BaseModel):
    batch: HistoricalImportBatch
    mapping_diagnostics: list[str] = Field(default_factory=list)
    review_diagnostics: list[str] = Field(default_factory=list)


class SyntheticSquadMembershipExportAdapter:
    """Normalize the supported synthetic squad export into historical-import/v1."""

    SUPPORTED_EXPORT_VERSION = "synthetic-squad-export/v1"

    def adapt(self, payload: dict[str, Any]) -> SyntheticSquadMembershipAdapterResult:
        document = SyntheticSquadMembershipExportDocument.model_validate(payload)
        if document.export_version != self.SUPPORTED_EXPORT_VERSION:
            raise ValueError("Unsupported synthetic squad export version.")

        mappings: dict[str, str] = {}
        records: list[dict[str, Any]] = []
        diagnostics: list[str] = []
        reviews: list[str] = []
        seen_memberships: set[str] = set()

        for row in document.rows:
            if row.membership_key in seen_memberships:
                reviews.append(f"duplicate squad membership key: {row.membership_key}")
                continue
            seen_memberships.add(row.membership_key)
            row_mappings = {
                row.membership_key: row.target_ownership_id,
                row.team_source_key: row.target_team_id,
                row.player_source_key: row.target_player_id,
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
                    "source_record_id": row.membership_key,
                    "mapping_key": row.membership_key,
                    "entity_type": "squad_membership",
                    "payload": {
                        "season_id": row.season_id,
                        "team_source_key": row.team_source_key,
                        "player_source_key": row.player_source_key,
                        "started_at": row.started_at.isoformat(),
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
        return SyntheticSquadMembershipAdapterResult(
            batch=batch,
            mapping_diagnostics=diagnostics,
            review_diagnostics=reviews,
        )
