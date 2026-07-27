"""Versioned contracts for deterministic historical-import validation."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class HistoricalImportMapping(BaseModel):
    source_key: str
    target_id: str


class HistoricalImportRecord(BaseModel):
    source_record_id: str
    mapping_key: str
    entity_type: str
    payload: dict[str, Any]


class HistoricalImportBatch(BaseModel):
    contract_version: Literal["historical-import/v1"]
    batch_id: str
    source_system: str
    synthetic: bool
    mappings: list[HistoricalImportMapping]
    records: list[HistoricalImportRecord]


class HistoricalImportAudit(BaseModel):
    batch_id: str
    contract_version: str
    dry_run: bool
    batch_digest: str = Field(min_length=64, max_length=64)
    created_payloads: int = 0
    archived_payloads: int = 0
    unchanged_payloads: int = 0
    mapping_conflicts: list[str] = Field(default_factory=list)
    review_items: list[str] = Field(default_factory=list)
    repeated_batch: bool = False
