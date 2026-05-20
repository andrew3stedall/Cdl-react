# Skill: Parallel Feature Development

## Purpose

Coordinate multiple agents developing separate features at the same time while protecting shared contracts and integration behaviour.

## Source of truth

Each agent must work from one feature document in `docs/features/active/`.

## Agent assignment rules

- Assign one feature document per agent.
- Record dependencies on other active feature documents.
- Avoid changing shared API contracts, Pydantic models, theme tokens, routes, or shared components without updating affected feature documents.
- Prefer small integration contracts over broad shared abstractions.

## Cross-feature testing

Every feature must consider:

- Shared authentication and session behaviour.
- Shared app shell and navigation.
- Shared theme presets and shadcn/ui components.
- Shared Python models and API clients.
- Shared database repositories and migrations.
- Existing active feature branches or tasks.

## Required output before completion

- Passing feature-specific tests.
- Passing relevant cross-feature integration tests.
- Updated wiki documentation.
- Updated changelog.
- Updated release documentation.
- Feature document moved from `docs/features/active/` to `docs/features/completed/{major|minor}/vX.Y.Z/`.
