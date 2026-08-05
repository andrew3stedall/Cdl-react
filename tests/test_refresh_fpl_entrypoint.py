import json
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

import cdl_api.refresh_fpl as refresh_module
from cdl_api.contracts.fpl_data import (
    FplCacheStatusResponse,
    FplRefreshResource,
    FplRefreshResponse,
    FplResourceRefreshResult,
    FplResourceStatus,
)


def _refresh_response() -> FplRefreshResponse:
    now = datetime.now(UTC)
    return FplRefreshResponse(
        resources=[
            FplResourceRefreshResult(
                resource=resource,
                endpoint=f"https://fantasy.premierleague.com/api/{resource.value}/",
                fetched_at=now,
                response_sha256="a" * 64,
                records_upserted={resource.value: 1},
            )
            for resource in FplRefreshResource
        ]
    )


def _status_response(*, fixture_count: int = 1) -> FplCacheStatusResponse:
    now = datetime.now(UTC)
    return FplCacheStatusResponse(
        resources=[
            FplResourceStatus(
                resource=resource,
                last_updated_at=now,
                last_fetch_status=200,
                response_sha256="a" * 64,
            )
            for resource in FplRefreshResource
        ],
        normalized_counts={
            "gameweeks": 1,
            "teams": 20,
            "players": 500,
            "fixtures": fixture_count,
        },
    )


def _patch_service(monkeypatch: pytest.MonkeyPatch, status: FplCacheStatusResponse) -> None:
    settings = SimpleNamespace(
        repository_mode="postgres",
        fpl_api_base_url="https://fantasy.premierleague.com/api",
        fpl_api_timeout_seconds=20.0,
    )

    class FakeService:
        def refresh(self, resources: list[FplRefreshResource]) -> FplRefreshResponse:
            assert resources == list(FplRefreshResource)
            return _refresh_response()

        def status(self) -> FplCacheStatusResponse:
            return status

    monkeypatch.setattr(refresh_module, "Settings", lambda: settings)
    monkeypatch.setattr(refresh_module, "build_session_factory", lambda _: object())
    monkeypatch.setattr(refresh_module, "PostgreSQLFplDataRepository", lambda _: object())
    monkeypatch.setattr(refresh_module, "FplApiClient", lambda **_: object())
    monkeypatch.setattr(refresh_module, "FplDataService", lambda *_: FakeService())


def test_refresh_entrypoint_outputs_successful_non_empty_status(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    _patch_service(monkeypatch, _status_response())

    refresh_module.main()

    payload = json.loads(capsys.readouterr().out)
    assert payload["status"]["normalized_counts"]["players"] == 500
    assert payload["status"]["normalized_counts"]["fixtures"] == 1
    assert [item["resource"] for item in payload["refresh"]["resources"]] == [
        "bootstrap-static",
        "fixtures",
    ]


def test_refresh_entrypoint_rejects_empty_official_fixture_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_service(monkeypatch, _status_response(fixture_count=0))

    with pytest.raises(RuntimeError, match="empty normalized resources: fixtures"):
        refresh_module.main()


def test_refresh_entrypoint_requires_postgresql(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        refresh_module,
        "Settings",
        lambda: SimpleNamespace(repository_mode="memory"),
    )

    with pytest.raises(RuntimeError, match="requires PostgreSQL repository mode"):
        refresh_module.main()
