# Codex Development Lifecycle

## Purpose

Define the standard lifecycle for building this application with React, Python, uv, Pydantic, tests, documentation, and changelog updates.

## Architecture

Development starts with Markdown specifications, then moves through API contracts, typed frontend and backend implementation, validation, documentation, and changelog updates.

## Syntax

Use this lifecycle for every change:

```text
specify -> design -> implement -> test -> document -> changelog -> review
```

## Examples

For a new feature:

1. Create `docs/specs/feature-name.md`.
2. Define API request and response models.
3. Implement Python service and repository classes.
4. Implement React components, hooks, and API client modules.
5. Add unit and integration tests.
6. Run quality gates.
7. Update `docs/wiki/feature-name.md`.
8. Update `CHANGELOG.md`.

## Testing

Required validation should include Python linting, Python formatting checks, Python tests, frontend linting, frontend tests, and frontend build checks.

## Changelog

See `CHANGELOG.md` for repository-level updates.
