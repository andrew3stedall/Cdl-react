# Codex Operating Instructions

This repository is for a modern React web application with a Python API backend.

## Stack

- Frontend: React and TypeScript.
- UI system: shadcn/ui is the default component and styling foundation.
- Theme presets: users must be able to choose from multiple configurable visual presets for application look and feel.
- Backend: Python with object-oriented services.
- Dependency manager: `uv`.
- Data and validation models: Pydantic.
- Quality: unit tests, integration tests, linting, formatting, Ruff, and build checks.
- Documentation: wiki-style Markdown for every change.
- Feature documents: all feature documents must be created under `docs/features/`.
- Changelog: update `CHANGELOG.md` for every change.

## Delivery rules

Every development task must include:

1. A Markdown feature document under `docs/features/`.
2. Implementation notes for frontend, backend, API, and data boundaries.
3. UI notes for shadcn/ui usage and theme presets when the task touches the interface.
4. Unit tests.
5. Integration tests.
6. Lint, format, Ruff, and build validation.
7. Wiki documentation with examples and syntax.
8. A changelog entry.

## Architecture preferences

- Prefer object-oriented programming for backend domain logic, services, repositories, adapters, and migration utilities.
- Keep React components focused on view behavior.
- Use shadcn/ui components by default before custom UI components.
- Keep visual styling configurable through documented presets rather than hard-coded one-off styles.
- Do not put raw SQL in route handlers or UI code.
- Use parameterized queries, repositories, query builders, or ORM models.
- Document API contracts before implementation.

## Validation baseline

```bash
uv sync
uv run ruff check .
uv run ruff format --check .
uv run pytest
npm install
npm run lint
npm run test
npm run build
```

Adjust frontend commands after the React app is initialized.
