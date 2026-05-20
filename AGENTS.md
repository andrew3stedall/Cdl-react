# Codex Operating Instructions

This repository is for a modern React web application with a Python API backend.

## Stack

- Frontend: React and TypeScript.
- Backend: Python with object-oriented services.
- Dependency manager: `uv`.
- Data and validation models: Pydantic.
- Quality: unit tests, integration tests, linting, formatting, Ruff, and build checks.
- Documentation: wiki-style Markdown for every change.
- Changelog: update `CHANGELOG.md` for every change.

## Delivery rules

Every development task must include:

1. A Markdown feature specification.
2. Implementation notes for frontend, backend, API, and data boundaries.
3. Unit tests.
4. Integration tests.
5. Lint, format, Ruff, and build validation.
6. Wiki documentation with examples and syntax.
7. A changelog entry.

## Architecture preferences

- Prefer object-oriented programming for backend domain logic, services, repositories, adapters, and migration utilities.
- Keep React components focused on view behavior.
- Keep business rules in typed hooks, service classes, or backend classes.
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
