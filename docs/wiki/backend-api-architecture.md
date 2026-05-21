# Backend API Architecture

## Purpose

Define the initial Python API foundation for the modern Castle Draft League application.

## Architecture

The backend uses FastAPI, Pydantic, uv, service classes, repository interfaces, and shared contract models.

## Syntax

Backend commands:

```bash
uv sync
uv run uvicorn cdl_api.app:app --reload
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Frontend commands:

```bash
cd frontend
npm install
npm run lint
npm run test
npm run build
```

## Examples

- `GET /health`
- `GET /api/contracts/theme-presets`

## Testing

Use the backend and frontend validation commands above before merge.

## Changelog

See `CHANGELOG.md`.
