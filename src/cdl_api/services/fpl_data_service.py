"""Application service for refreshing official FPL cache resources."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from datetime import datetime, timezone
from typing import Protocol

from cdl_api.contracts.fpl_data import (
    FplCacheStatusResponse,
    FplRefreshResource,
    FplRefreshResponse,
)
from cdl_api.fpl_client import FplApiError, FplApiResponse
from cdl_api.repositories.postgres_fpl_data import PostgreSQLFplDataRepository


class FplApiClientProtocol(Protocol):
    def endpoint_for(self, path: str) -> str:
        ...

    def fetch_bootstrap_static(self) -> FplApiResponse:
        ...

    def fetch_fixtures(self) -> FplApiResponse:
        ...


class FplDataService:
    def __init__(
        self,
        client: FplApiClientProtocol,
        repository: PostgreSQLFplDataRepository,
    ) -> None:
        self._client = client
        self._repository = repository

    def refresh(self, resources: Iterable[FplRefreshResource]) -> FplRefreshResponse:
        results = []
        for resource in resources:
            fetched_at = datetime.now(timezone.utc)
            endpoint = self._endpoint_for(resource)
            try:
                response = self._fetch(resource)
                response_sha256 = _payload_sha256(response.payload)
                if resource is FplRefreshResource.BOOTSTRAP_STATIC:
                    if not isinstance(response.payload, dict):
                        raise FplApiError("FPL bootstrap-static payload must be an object.")
                    result = self._repository.persist_bootstrap_static(
                        response.payload,
                        endpoint=response.endpoint,
                        status_code=response.status_code,
                        response_sha256=response_sha256,
                        fetched_at=fetched_at,
                    )
                else:
                    if not isinstance(response.payload, list):
                        raise FplApiError("FPL fixtures payload must be a list.")
                    result = self._repository.persist_fixtures(
                        response.payload,
                        endpoint=response.endpoint,
                        status_code=response.status_code,
                        response_sha256=response_sha256,
                        fetched_at=fetched_at,
                    )
                results.append(result)
            except Exception as exc:
                self._repository.record_failure(
                    resource=resource,
                    endpoint=endpoint,
                    fetched_at=fetched_at,
                    error=str(exc),
                )
                raise
        return FplRefreshResponse(resources=results)

    def status(self) -> FplCacheStatusResponse:
        return self._repository.status()

    def _fetch(self, resource: FplRefreshResource) -> FplApiResponse:
        if resource is FplRefreshResource.BOOTSTRAP_STATIC:
            return self._client.fetch_bootstrap_static()
        return self._client.fetch_fixtures()

    def _endpoint_for(self, resource: FplRefreshResource) -> str:
        suffix = (
            "bootstrap-static/"
            if resource is FplRefreshResource.BOOTSTRAP_STATIC
            else "fixtures/"
        )
        return self._client.endpoint_for(suffix)


def _payload_sha256(payload: object) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
