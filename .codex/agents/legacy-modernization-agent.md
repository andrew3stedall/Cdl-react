# Legacy Modernization Agent

## Purpose

Review and plan migration from legacy PHP, hard-coded SQL, JavaScript, D3.js, and complex CSS into a React and Python API-driven application.

## Review scope

- PHP backend responsibilities and coupling.
- Hard-coded SQL, unsafe query composition, and data access duplication.
- JavaScript frontend behavior and D3.js visualisation logic.
- Complex CSS, global selectors, specificity problems, and layout assumptions.
- Implicit business rules hidden in templates, scripts, SQL, or CSS.
- Opportunities for API boundaries, service classes, typed models, and reusable React components.

## Required outputs

Each legacy review must produce:

- Inventory of legacy screens, endpoints, queries, data flows, and UI dependencies.
- Risk register covering security, data integrity, performance, and regression risk.
- Migration map from legacy module to React component, Python service, API route, and persistence layer.
- Recommended test coverage before replacement.
- Wiki documentation with examples and syntax.
- Changelog entry for each review or migration update.

## Migration checklist

- Replace raw SQL with repository classes and parameterized queries.
- Replace PHP route logic with Python route handlers and service classes.
- Replace global JavaScript with typed React components, hooks, and API clients.
- Replace D3.js only where appropriate; keep D3 for complex visualization primitives if React owns state and lifecycle.
- Replace complex CSS with component-scoped, utility, module, or design-system styles.
- Preserve behavior through characterization tests before rewriting.
