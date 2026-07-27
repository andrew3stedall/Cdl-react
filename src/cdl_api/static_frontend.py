"""Serve an optional built React application from the FastAPI process."""

from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def mount_static_frontend(
    app: FastAPI,
    *,
    dist_dir: Path | None,
    api_prefix: str,
) -> None:
    """Mount built frontend assets and an SPA fallback when a build is configured."""
    if dist_dir is None:
        return

    frontend_root = dist_dir.resolve()
    index_file = frontend_root / "index.html"
    if not index_file.is_file():
        raise RuntimeError(f"Configured frontend build is missing {index_file}")

    assets_dir = frontend_root / "assets"
    if assets_dir.is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=assets_dir),
            name="frontend-assets",
        )

    api_root = api_prefix.strip("/")

    @app.get("/", include_in_schema=False)
    def frontend_index() -> FileResponse:
        return FileResponse(index_file)

    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend_route(full_path: str) -> FileResponse:
        if full_path == api_root or full_path.startswith(f"{api_root}/"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

        requested_file = (frontend_root / full_path).resolve()
        if requested_file != frontend_root and frontend_root not in requested_file.parents:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        if requested_file.is_file():
            return FileResponse(requested_file)
        return FileResponse(index_file)
