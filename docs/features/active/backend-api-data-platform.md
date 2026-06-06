# Feature: Backend API and Data Platform

## Purpose

Plan the Python backend platform that replaces PHP endpoints, hard-coded SQL access, and frontend-coupled data shaping with API-driven services, Pydantic models, repository classes, and testable business logic.

## Status

Implemented foundation. Persistent storage wiring, full repository coverage, and legacy endpoint parity remain pending.

## Legacy Inventory

Sampled frontend modules call PHP endpoints including:

- `getInitialSquadData.php`
- `getTeamSelectionData.php`
- `getFixtureResultData.php`
- `getFdrData.php`
- Session and logout endpoints such as `checkSession.js` and `logout.php`

Legacy JavaScript expects large aggregated JSON payloads and often performs UI-specific transformation in the browser.

## Current Behaviour

PHP endpoints supply current gameweek data, teams, players, interests, trades, fixtures, tables, chips, dashboard data, and FDR data to static pages.

## Business Rules

- Backend services must own validation and domain rules.
- Frontend requests must use documented API contracts.
- SQL must not be embedded in route handlers.
- Data access must be isolated behind repositories.

## Risks

- Existing PHP endpoints may combine authentication, queries, and formatting.
- Database schema and query logic require deeper review before implementation.
- Legacy responses may contain fields used implicitly by D3 rendering.
- Large payload endpoints may need decomposition for performance.

## Target Architecture

- Python API managed with `uv`.
- Pydantic models for settings, requests, responses, errors, and domain DTOs.
- Object-oriented services for authentication, squads, teams, fixtures, tables, trades, dashboard, FDR, and rules.
- Repository classes for database access.
- API routers grouped by domain.
- Integration tests for API and persistence boundaries.

## API Requirements

Initial API groups:

- `/api/auth/*`
- `/api/me/*`
- `/api/squad/*`
- `/api/scouting/*`
- `/api/interests/*`
- `/api/trades/*`
- `/api/team-selection/*`
- `/api/league/*`
- `/api/rules/*`
- `/api/dashboard/*`
- `/api/fdr/*`

## React Requirements

- Typed API client modules per domain.
- Shared error handling.
- Query caching strategy.
- Contract-driven integration tests.

## UI Requirements

- API errors must map to shadcn/ui alert, toast, form message, and dialog patterns.
- Visual presets must not change API behaviour.

## Data Access Requirements

- Use repository classes for all database reads and writes.
- Use parameterized queries or ORM/query-builder abstractions.
- Keep database transaction boundaries explicit.
- Document database views or stored logic that remains during migration.

## Acceptance Criteria

- Backend architecture supports all planned modern features.
- Every endpoint has Pydantic request and response models.
- Every domain has service and repository boundaries.
- Test commands are documented and runnable once implementation exists.

## Test Requirements

- Unit tests for service classes and model validation.
- Integration tests for API endpoints and repositories.
- Ruff lint and format checks.
- Type checking when configured.
- Contract tests between API responses and frontend clients.

## Documentation Requirements

- Wiki page for backend architecture, uv usage, API conventions, Pydantic syntax, repository examples, and testing commands.

## Changelog Requirements

- Add implementation changelog entry when built.
