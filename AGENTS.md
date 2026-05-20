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
- Feature documents: all development must start from feature documents under `docs/features/active/`.
- Completed feature documents: move implemented feature documents to `docs/features/completed/{major|minor}/vX.Y.Z/`.
- Release documentation: capture completed features in `docs/releases/`.
- Changelog: update `CHANGELOG.md` for every change.

## Delivery rules

Every development task must include:

1. A Markdown feature document under `docs/features/active/` before implementation starts.
2. Implementation notes for frontend, backend, API, and data boundaries.
3. UI notes for shadcn/ui usage and theme presets when the task touches the interface.
4. Unit tests.
5. Integration tests.
6. Cross-feature testing notes when other features are being developed in parallel.
7. Lint, format, Ruff, and build validation.
8. Wiki documentation with examples and syntax.
9. A changelog entry.
10. Movement of the implemented feature document to the correct completed release folder.
11. Release documentation updates under `docs/releases/`.

## Feature document lifecycle

Use this lifecycle for every feature:

```text
docs/features/active/feature-name.md
  -> implement from feature document
  -> validate feature and cross-feature impact
  -> docs/features/completed/{major|minor}/vX.Y.Z/feature-name.md
  -> docs/releases/vX.Y.Z.md
```

## Parallel agent coordination

Multiple agents may work in parallel when each agent owns a separate feature document. Parallel work must follow these rules:

- One feature document is the source of truth for one feature branch or task.
- Shared API contracts, models, routes, theme tokens, and components must be treated as integration points.
- Each feature must document dependencies on other active features.
- Testing must include the feature's own tests and relevant cross-feature integration tests.
- Agents must avoid incompatible changes to shared contracts unless the affected feature documents are updated together.

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
