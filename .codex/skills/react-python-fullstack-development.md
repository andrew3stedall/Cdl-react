# Skill: React and Python Fullstack Development

## Purpose

Deliver API-driven features using React, TypeScript, Python, uv, Pydantic, and object-oriented backend design.

## Process

1. Start with a Markdown feature specification.
2. Define API request and response contracts.
3. Create Pydantic models for validation boundaries.
4. Design backend service and repository classes.
5. Design React components, hooks, and typed API clients.
6. Implement tests before or alongside code.
7. Run quality gates.
8. Update wiki documentation and changelog.

## Backend guidance

- Put validation at API boundaries with Pydantic models.
- Put business rules in service classes.
- Put database access in repository classes.
- Keep route handlers thin.

## Frontend guidance

- Use typed API clients.
- Use hooks for data fetching and UI orchestration.
- Keep components focused on rendering and interaction.
- Cover loading, error, empty, and success states.

## Required validation

- `uv run ruff check .`
- `uv run ruff format --check .`
- `uv run pytest`
- `npm run lint`
- `npm run test`
- `npm run build`
