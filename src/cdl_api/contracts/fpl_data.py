"""Contracts for official Fantasy Premier League data ingestion."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator


class FplRefreshResource(StrEnum):
    BOOTSTRAP_STATIC = "bootstrap-static"
    FIXTURES = "fixtures"


class FplRefreshRequest(BaseModel):
    resources: list[FplRefreshResource] = Field(
        default_factory=lambda: [
            FplRefreshResource.BOOTSTRAP_STATIC,
            FplRefreshResource.FIXTURES,
        ],
        min_length=1,
    )

    @field_validator("resources")
    @classmethod
    def resources_must_be_unique(
        cls,
        resources: list[FplRefreshResource],
    ) -> list[FplRefreshResource]:
        if len(resources) != len(set(resources)):
            raise ValueError("FPL refresh resources must be unique.")
        return resources


class FplResourceRefreshResult(BaseModel):
    resource: FplRefreshResource
    endpoint: str
    fetched_at: datetime
    response_sha256: str
    records_upserted: dict[str, int]


class FplRefreshResponse(BaseModel):
    resources: list[FplResourceRefreshResult]


class FplResourceStatus(BaseModel):
    resource: FplRefreshResource
    last_updated_at: datetime | None = None
    last_fetch_status: int | None = None
    last_fetch_error: str | None = None
    response_sha256: str | None = None


class FplCacheStatusResponse(BaseModel):
    resources: list[FplResourceStatus]
    normalized_counts: dict[str, int]
