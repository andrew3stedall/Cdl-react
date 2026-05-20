# Skill: Testing and Quality Gates

## Purpose

Define required validation for React and Python lifecycle work.

## Required test layers

- Unit tests for functions, classes, services, hooks, and components.
- Integration tests for API routes, persistence boundaries, and frontend API flows.
- Characterization tests before replacing legacy behavior.
- Build checks for deployable frontend and backend packages.

## Python checks

- Run Ruff lint checks.
- Run Ruff format checks.
- Run pytest.
- Run type checking when configured.

## Frontend checks

- Run lint checks.
- Run tests.
- Run build checks.
- Run type checking when configured.

## Recommended lifecycle

1. Install dependencies.
2. Check formatting.
3. Run linting.
4. Run type checks.
5. Run unit tests.
6. Run integration tests.
7. Build artifacts.
8. Record validation in the changelog.

## Review checklist

- Tests are named by behavior.
- Integration tests cover real boundaries.
- Validation evidence is included in the changelog.
- Missing checks are documented with rationale.
