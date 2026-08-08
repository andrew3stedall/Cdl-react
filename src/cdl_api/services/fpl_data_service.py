"""Application service for refreshing official FPL cache resources."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping
from datetime import UTC, datetime, timedelta
from typing import Protocol

from cdl_api.contracts.fpl_data import (
    FplCacheStatusResponse,
    FplPlayerGameweekHistory,
    FplPlayerHistoryResponse,
    FplPlayerUpcomingFixture,
    FplRefreshResource,
    FplRefreshResponse,
)
from cdl_api.fpl_client import FplApiError, FplApiResponse
from cdl_api.repositories.postgres_fpl_data import PostgreSQLFplDataRepository

ELEMENT_SUMMARY_TTL = timedelta(hours=6)


class FplApiClientProtocol(Protocol):
    def endpoint_for(self, path: str) -> str: ...

    def fetch_bootstrap_static(self) -> FplApiResponse: ...

    def fetch_fixtures(self) -> FplApiResponse: ...

    def fetch_element_summary(self, player_id: int) -> FplApiResponse: ...


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
            fetched_at = datetime.now(UTC)
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

    def player_history(self, player_id: str) -> FplPlayerHistoryResponse:
        resource = f"element-summary:{player_id}"
        cached = self._repository.cached_payload(resource)
        now = datetime.now(UTC)
        if cached is not None:
            payload, fetched_at, response_sha256 = cached
            if _cache_is_fresh(fetched_at, now):
                return _player_history_response(
                    player_id,
                    payload,
                    fetched_at=fetched_at,
                    response_sha256=response_sha256,
                )

        external_player_id = _external_player_id(player_id)
        endpoint = self._client.endpoint_for(f"element-summary/{external_player_id}/")
        fetched_at = now
        try:
            response = self._client.fetch_element_summary(external_player_id)
            if not isinstance(response.payload, dict):
                raise FplApiError("FPL element-summary payload must be an object.")
            response_sha256 = _payload_sha256(response.payload)
            self._repository.persist_element_summary(
                player_id,
                response.payload,
                endpoint=response.endpoint,
                status_code=response.status_code,
                response_sha256=response_sha256,
                fetched_at=fetched_at,
            )
            return _player_history_response(
                player_id,
                response.payload,
                fetched_at=fetched_at,
                response_sha256=response_sha256,
            )
        except Exception as exc:
            self._repository.record_failure(
                resource=resource,
                endpoint=endpoint,
                fetched_at=fetched_at,
                error=str(exc),
            )
            raise

    def status(self) -> FplCacheStatusResponse:
        return self._repository.status()

    def _fetch(self, resource: FplRefreshResource) -> FplApiResponse:
        if resource is FplRefreshResource.BOOTSTRAP_STATIC:
            return self._client.fetch_bootstrap_static()
        return self._client.fetch_fixtures()

    def _endpoint_for(self, resource: FplRefreshResource) -> str:
        suffix = (
            "bootstrap-static/" if resource is FplRefreshResource.BOOTSTRAP_STATIC else "fixtures/"
        )
        return self._client.endpoint_for(suffix)


def _cache_is_fresh(fetched_at: datetime, now: datetime) -> bool:
    normalized = fetched_at if fetched_at.tzinfo is not None else fetched_at.replace(tzinfo=UTC)
    return now - normalized <= ELEMENT_SUMMARY_TTL


def _external_player_id(player_id: str) -> int:
    prefix = "fpl-"
    if not player_id.startswith(prefix):
        raise FplApiError(f"Unsupported FPL player identity {player_id!r}.")
    try:
        return int(player_id.removeprefix(prefix))
    except ValueError as exc:
        raise FplApiError(f"Unsupported FPL player identity {player_id!r}.") from exc


def _player_history_response(
    player_id: str,
    payload: object,
    *,
    fetched_at: datetime,
    response_sha256: str,
) -> FplPlayerHistoryResponse:
    if not isinstance(payload, Mapping):
        raise FplApiError("Cached FPL element-summary payload must be an object.")
    raw_history = payload.get("history")
    raw_fixtures = payload.get("fixtures")
    if not isinstance(raw_history, list) or not all(
        isinstance(row, Mapping) for row in raw_history
    ):
        raise FplApiError("FPL element-summary history must be a list of objects.")
    if not isinstance(raw_fixtures, list) or not all(
        isinstance(row, Mapping) for row in raw_fixtures
    ):
        raise FplApiError("FPL element-summary fixtures must be a list of objects.")

    history = [
        FplPlayerGameweekHistory(
            gameweek=_as_int(row.get("round")),
            fixture_id=_as_int(row.get("fixture")),
            opponent_team_id=_as_int(row.get("opponent_team")),
            total_points=_as_int(row.get("total_points")),
            minutes=_as_int(row.get("minutes")),
            goals_scored=_as_int(row.get("goals_scored")),
            assists=_as_int(row.get("assists")),
            clean_sheets=_as_int(row.get("clean_sheets")),
            bonus=_as_int(row.get("bonus")),
            bps=_as_int(row.get("bps")),
            expected_goals=_as_float(row.get("expected_goals")),
            expected_assists=_as_float(row.get("expected_assists")),
            value=_as_float(row.get("value")) / 10,
            was_home=bool(row.get("was_home", False)),
            kickoff_time=_as_datetime(row.get("kickoff_time")),
        )
        for row in raw_history
    ]
    fixtures = [
        FplPlayerUpcomingFixture(
            fixture_id=_as_int(row.get("id")),
            gameweek=_as_optional_int(row.get("event")),
            opponent_team_id=_as_int(row.get("opponent_team")),
            difficulty=_as_int(row.get("difficulty")),
            is_home=bool(row.get("is_home", False)),
            kickoff_time=_as_datetime(row.get("kickoff_time")),
        )
        for row in raw_fixtures
    ]
    return FplPlayerHistoryResponse(
        player_id=player_id,
        fetched_at=fetched_at,
        response_sha256=response_sha256,
        history=history,
        fixtures=fixtures,
    )


def _as_int(value: object) -> int:
    if value is None or value == "":
        return 0
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise FplApiError("FPL element-summary integer field is invalid.") from exc


def _as_optional_int(value: object) -> int | None:
    if value is None or value == "":
        return None
    return _as_int(value)


def _as_float(value: object) -> float:
    if value is None or value == "":
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise FplApiError("FPL element-summary numeric field is invalid.") from exc


def _as_datetime(value: object) -> datetime | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise FplApiError("FPL element-summary datetime field is invalid.")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise FplApiError("FPL element-summary datetime field is invalid.") from exc


def _payload_sha256(payload: object) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
