"""Adapter for one concrete, explicitly synthetic fixture-export shape."""

from typing import Any

from pydantic import BaseModel, Field

from cdl_api.contracts.imports import HistoricalImportBatch


class SyntheticFixtureExportRow(BaseModel):
    fixture_key: str
    target_fixture_id: str
    gameweek: int = Field(ge=1)
    home_team_id: str
    home_team_name: str
    home_team_short_name: str
    away_team_id: str
    away_team_name: str
    away_team_short_name: str
    status: str
    kickoff_label: str
    round_label: str
    detail_available: bool = True


class SyntheticFixtureExportDocument(BaseModel):
    export_version: str
    batch_id: str
    source_system: str
    rows: list[SyntheticFixtureExportRow]


class SyntheticFixtureAdapterResult(BaseModel):
    batch: HistoricalImportBatch
    mapping_diagnostics: list[str] = Field(default_factory=list)
    review_diagnostics: list[str] = Field(default_factory=list)


class SyntheticFixtureExportAdapter:
    """Normalize the supported synthetic export into historical-import/v1."""

    SUPPORTED_EXPORT_VERSION = "synthetic-fixture-export/v1"

    def adapt(self, payload: dict[str, Any]) -> SyntheticFixtureAdapterResult:
        document = SyntheticFixtureExportDocument.model_validate(payload)
        if document.export_version != self.SUPPORTED_EXPORT_VERSION:
            raise ValueError("Unsupported synthetic fixture export version.")

        mappings: list[dict[str, str]] = []
        records: list[dict[str, Any]] = []
        mapping_diagnostics: list[str] = []
        review_diagnostics: list[str] = []
        seen_fixture_keys: set[str] = set()

        for row in document.rows:
            if row.fixture_key in seen_fixture_keys:
                review_diagnostics.append(f"duplicate fixture key: {row.fixture_key}")
                continue
            seen_fixture_keys.add(row.fixture_key)
            mappings.append({"source_key": row.fixture_key, "target_id": row.target_fixture_id})
            mapping_diagnostics.append(f"{row.fixture_key} -> {row.target_fixture_id}")
            records.append(
                {
                    "source_record_id": row.fixture_key,
                    "mapping_key": row.fixture_key,
                    "entity_type": "cdl_fixture",
                    "payload": {
                        "gameweek": {
                            "id": f"gw-{row.gameweek}",
                            "name": f"Gameweek {row.gameweek}",
                            "number": row.gameweek,
                        },
                        "home_team": {
                            "id": row.home_team_id,
                            "name": row.home_team_name,
                            "short_name": row.home_team_short_name,
                        },
                        "away_team": {
                            "id": row.away_team_id,
                            "name": row.away_team_name,
                            "short_name": row.away_team_short_name,
                        },
                        "status": row.status,
                        "kickoff_label": row.kickoff_label,
                        "round_label": row.round_label,
                        "detail_available": row.detail_available,
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
        return SyntheticFixtureAdapterResult(
            batch=batch,
            mapping_diagnostics=mapping_diagnostics,
            review_diagnostics=review_diagnostics,
        )
