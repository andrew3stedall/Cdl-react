# Skill: React and Python Fullstack Development

## Purpose

Deliver API-driven features using React, TypeScript, shadcn/ui, Python, uv, Pydantic, and object-oriented backend design.

## Source of truth

Development must be based on a feature document in `docs/features/active/`.

Implementation must not start until the feature document includes acceptance criteria, API requirements, React requirements, UI requirements, data access requirements, test requirements, cross-feature test requirements, documentation requirements, and changelog requirements.

## Process

1. Select one feature document from `docs/features/active/`.
2. Confirm dependencies on other active feature documents.
3. Define or confirm API request and response contracts.
4. Create Pydantic models for validation boundaries.
5. Design backend service and repository classes.
6. Design React components, hooks, typed API clients, and shadcn/ui usage.
7. Define configurable visual presets when the feature touches the interface.
8. Implement tests before or alongside code.
9. Run quality gates and cross-feature tests.
10. Update wiki documentation and changelog.
11. Move the feature document to `docs/features/completed/{major|minor}/vX.Y.Z/`.
12. Update `docs/releases/vX.Y.Z.md` with the completed feature.

## Parallel work rules

- One agent should own one active feature document at a time.
- Shared contracts must be changed deliberately and reflected in every affected active feature document.
- Cross-feature tests must cover impacted routes, API contracts, shared models, theme tokens, and shared components.
- Conflicting assumptions must be resolved in the feature documents before implementation continues.

## Backend guidance

- Put validation at API boundaries with Pydantic models.
- Put business rules in service classes.
- Put database access in repository classes.
- Keep route handlers thin.

## Frontend guidance

- Use typed API clients.
- Use shadcn/ui components by default.
- Use hooks for data fetching and UI orchestration.
- Keep components focused on rendering and interaction.
- Cover loading, error, empty, and success states.
- Keep look and feel configurable through documented visual presets.

## Required validation

- `uv run ruff check .`
- `uv run ruff format --check .`
- `uv run pytest`
- `npm run lint`
- `npm run test`
- `npm run build`
