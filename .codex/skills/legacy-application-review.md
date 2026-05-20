# Skill: Legacy Application Review

## Purpose

Review a legacy application and create feature documents for migration to React, Python, and API-driven architecture.

## Required output

This skill creates feature documents. It does not create implementation source code unless a separate task explicitly asks for implementation.

All feature documents must be created in `docs/features/`.

Use kebab-case filenames, for example:

- `docs/features/reporting-dashboard.md`
- `docs/features/customer-search.md`

## Process

1. Inventory screens, routes, forms, reports, jobs, queries, and assets.
2. Identify business rules in backend code, queries, frontend scripts, templates, and styles.
3. Classify each module by complexity, risk, and migration value.
4. Create one feature document per migration feature in `docs/features/`.
5. Define React, Python API, Pydantic, service, repository, test, documentation, and changelog requirements.

## Feature document sections

- Legacy Inventory
- Current Behaviour
- Business Rules
- Risks
- Target Architecture
- API Requirements
- React Requirements
- Data Access Requirements
- Acceptance Criteria
- Test Requirements
- Documentation Requirements
- Changelog Requirements
