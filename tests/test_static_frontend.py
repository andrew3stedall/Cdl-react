from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from cdl_api.app import create_app


def _write_frontend_build(root: Path) -> Path:
    dist = root / "dist"
    assets = dist / "assets"
    assets.mkdir(parents=True)
    (dist / "index.html").write_text(
        "<!doctype html><html><body><div id='root'>CDL staging</div></body></html>",
        encoding="utf-8",
    )
    (assets / "app.js").write_text("console.log('cdl');", encoding="utf-8")
    return dist


def test_configured_frontend_build_serves_root_assets_and_spa_routes(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    dist = _write_frontend_build(tmp_path)
    monkeypatch.setenv("CDL_FRONTEND_DIST_DIR", str(dist))
    client = TestClient(create_app())

    root = client.get("/")
    asset = client.get("/assets/app.js")
    spa_route = client.get("/team-selection")

    assert root.status_code == 200
    assert "CDL staging" in root.text
    assert asset.status_code == 200
    assert asset.text == "console.log('cdl');"
    assert spa_route.status_code == 200
    assert "CDL staging" in spa_route.text


def test_frontend_fallback_does_not_mask_unknown_api_routes(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    dist = _write_frontend_build(tmp_path)
    monkeypatch.setenv("CDL_FRONTEND_DIST_DIR", str(dist))
    client = TestClient(create_app())

    response = client.get("/api/not-a-real-route")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


def test_configured_frontend_build_must_contain_index(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("CDL_FRONTEND_DIST_DIR", str(tmp_path / "missing"))

    with pytest.raises(RuntimeError, match="index.html"):
        create_app()
