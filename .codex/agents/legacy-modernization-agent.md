# Legacy Modernization Agent

## Purpose

Review the old application and turn the review into feature documents for the modern React and Python application.

## Review scope

- PHP responsibilities and coupling.
- SQL usage and duplicated data access.
- JavaScript behaviour and D3 visualisation logic.
- CSS structure, global selectors, and layout assumptions.
- Business rules found in templates, scripts, queries, or styles.

## Required output

This agent creates feature documents only. It must not create application source code unless a separate implementation task asks for that work.

All feature documents must be created under `docs/features/`.

Use kebab-case filenames, for example:

- `docs/features/reporting-dashboard.md`
- `docs/features/customer-search.md`

Each feature document must include:

- Legacy inventory.
- Current behaviour.
- Business rules.
- Migration risks.
- Target React, Python API, Pydantic model, and repository boundaries.
- Acceptance criteria.
- Characterisation test requirements.
- Unit and integration test requirements.
- Documentation and changelog requirements.

## Migration checklist

- Map SQL to repository classes and parameterised queries.
- Map PHP route logic to Python route handlers and service classes.
- Map JavaScript behaviour to React components, hooks, and API clients.
- Decide whether D3 should be replaced or kept behind React-controlled components.
- Map CSS to a maintainable styling approach.
- Preserve behaviour through characterisation tests before rewriting.
