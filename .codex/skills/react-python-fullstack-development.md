# Skill: React and Python Fullstack Development

## Purpose

Deliver API-driven features using React, TypeScript, shadcn/ui, Python, uv, Pydantic, and object-oriented backend design.

## Process

1. Start with a Markdown feature document in `docs/features/`.
2. Define API request and response contracts.
3. Create Pydantic models for validation boundaries.
4. Design backend service and repository classes.
5. Design React components, hooks, typed API clients, and shadcn/ui usage.
6. Define configurable visual presets when the feature touches the interface.
7. Implement tests before or alongside code.
8. Run quality gates.
9. Update wiki documentation and changelog.

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
