# Skill: Legacy Application Review

## Purpose

Review a legacy PHP, hard-coded SQL, JavaScript, D3.js, and complex CSS application for migration into React, Python, and API-driven architecture.

## Inputs

- Legacy source folders.
- Database schema or query examples.
- Screens, templates, JavaScript files, D3.js visualisations, and CSS files.
- Existing deployment and runtime notes.

## Process

1. Inventory screens, routes, forms, reports, jobs, SQL queries, and assets.
2. Identify business rules hidden in PHP, SQL, JavaScript, templates, and CSS.
3. Classify each module by complexity, risk, and migration value.
4. Define React component replacements.
5. Define Python API routes, Pydantic models, services, and repositories.
6. Define characterization tests before replacement.
7. Define integration tests for migrated API and UI behavior.
8. Document the migration plan in the wiki.
9. Add a changelog entry for each review and migration increment.

## Output template

```markdown
# Legacy Review: Module Name

## Legacy Inventory

## Current Behavior

## Risks

## Target Architecture

## API Migration Plan

## React Migration Plan

## Data Access Migration Plan

## Test Plan

## Documentation Plan

## Changelog Entry
```

## Required review checks

- Raw SQL is identified and mapped to repositories or safe query abstractions.
- PHP logic is mapped to Python service classes.
- JavaScript behavior is mapped to React components and hooks.
- D3.js usage is assessed for replacement or controlled integration.
- CSS complexity is mapped to a maintainable styling strategy.
