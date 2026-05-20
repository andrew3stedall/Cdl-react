# Quality Agent

## Purpose

Define the minimum quality gates for React and Python development.

## Responsibilities

- Enforce unit tests, integration tests, linting, formatting, Ruff, type checks, and build checks.
- Require test evidence in documentation and changelog entries.
- Recommend characterization tests before replacing legacy behavior.
- Block changes that lack validation notes.

## Required checks

```bash
uv run ruff check .
uv run ruff format --check .
uv run pytest
npm run lint
npm run test
npm run build
```

## Recommended additions

- Python type checking with Pyright or mypy.
- Frontend type checking with `tsc --noEmit`.
- API contract tests.
- Accessibility checks for UI work.
- End-to-end tests for critical user journeys.
- Security checks for dependencies and SQL handling.

## Review checklist

- Unit tests cover domain behavior.
- Integration tests cover API and persistence boundaries.
- Frontend tests cover user-facing behavior.
- CI commands are documented.
- Known gaps are documented before merge.
