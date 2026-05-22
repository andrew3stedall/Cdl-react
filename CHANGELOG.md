# Changelog

## 2026-05-22 - Implement team selection and chip management

### Added

- Added team selection contracts for lineup slots, selectable players, chip states, lineup update requests, chip update requests, fixture summary panels, and validation responses.
- Added in-memory team selection repository and services for lineup validation, chip lifecycle validation, and fixture/table summaries.
- Added API routes for `GET /api/team-selection`, `PUT /api/team-selection/lineup`, `PUT /api/team-selection/chips/{chip_id}`, and `GET /api/team-selection/fixtures-summary`.
- Added `/team-selection` React route inside the shared shell with chip selector cards, starter layout, bench/reserve panels, accessible player movement controls, validation messages, and fixture/table summary cards.
- Added wiki documentation for lineup validation, chip lifecycle, API syntax, and examples.

### Validation

- Added backend service tests for selection load, valid lineup updates, invalid lineup validation, chip activation, used-chip validation, second-active-chip validation, and fixture summaries.
- Added backend API integration tests for selection load, lineup update, lineup validation errors, chip activation/validation, and fixture summary context.
- Added frontend tests for team-selection rendering, chip toggles, invalid lineup feedback, and shell/session route behaviour.
- Feature document remains under `docs/features/active/` until CI validation passes.

## 2026-05-22 - Implement squad management scouting and transfers

### Added

- Added squad management contracts for player detail, squad summary, scouting filters, interests, and trade proposals.
- Added in-memory squad repository and service layer for squad totals, scouting, interest validation, and trade proposal workflows.
- Added API routes for `GET /api/squad/summary`, `GET /api/scouting/players`, `POST /api/interests`, `DELETE /api/interests/{interest_id}`, `GET /api/trades`, `POST /api/trades`, and `PUT /api/trades/{trade_id}`.
- Added `/squad-management` React route inside the shared shell with summary cards, scouting search, dense tables, interest creation, proposed trade action, and shared player detail dialog.
- Added squad management wiki documentation.

### Validation

- Added backend service tests for squad totals, scouting filters, interest validation, and trade rules links.
- Added backend API integration tests for summary, scouting filters, interest create/delete, validation errors, and trade create/update flow.
- Added frontend tests for squad rendering, scouting filtering, interest creation, trade rule links, and player detail.
- Feature document remains under `docs/features/active/` until CI validation passes.

## 2026-05-22 - Implement league fixtures and table

### Added

- Added league fixture, table, knockout, and head-to-head backend contracts.
- Added in-memory league repository data for current fixtures, next fixtures, playoff context, and started fixture details.
- Added `FixtureService`, `LeagueTableService`, `KnockoutService`, and `HeadToHeadService` boundaries.
- Added API routes for current fixtures, next fixtures, all fixtures, fixture detail, table, knockout, and head-to-head data under `/api/league`.
- Added a React league route surface inside the authenticated application shell.

### Validation

- Added backend service tests for fixture separation, fixture details, table calculations, knockout context, and head-to-head context.
- Added backend API tests for league fixture, table, knockout, and head-to-head endpoints.
- Added frontend shell tests for authenticated league route rendering.
- Feature document remains under `docs/features/active/` until CI validation passes.

## 2026-05-22 - Implement application shell navigation and presets

### Added

- Added a responsive React application shell with desktop sidebar navigation, mobile drawer navigation, shared reload action, scouting access, and global sign-out affordance.
- Added route-aware navigation configuration for Squad Management, Team Selection, League, Rules, Dashboard, FDR, and Scouting.
- Added tokenized `classic`, `dark`, and `compact` visual presets with colour, density, radius, typography, and chart palette hooks.
- Added user preference API support for `GET /api/me/preferences` and `PUT /api/me/preferences` with repository and service boundaries.
- Added wiki documentation for shell layout, navigation syntax, visual preset syntax, preference API usage, and cross-feature behaviour.

### Validation

- Added frontend unit tests for navigation configuration.
- Added frontend integration tests for authenticated shell rendering, mobile drawer behaviour, route changes, preset persistence, and unauthenticated shell blocking.
- Added backend integration tests for preference API round trip.
- Added backend service tests for preference defaults, persistence, and unsupported preset fallback.
- Feature document remains under `docs/features/active/` until CI validation passes.

## 2026-05-22 - Add rules knowledge base

### Added

- Added structured rules contracts, service, and API routes.
- Added searchable rule categories, stable rule identifiers, anchors, and version metadata.
- Added frontend rules page, search helpers, deep-link helpers, and route redirect behaviour.
- Added backend contract, service, and API tests.
- Added frontend search, deep-link, and shell/session behaviour tests.
- Added rules knowledge base wiki documentation.

### Validation

- Added unit tests for rule contracts and search helpers.
- Added integration tests for rules API list, category filter, search, and detail endpoints.
- Added cross-feature tests for rules route behaviour with authenticated and unauthenticated sessions.

## 2026-05-21 - Add authentication and session management

### Added

- Added auth contracts, service layer, repositories, and API routes.
- Added login, session status, and logout behaviour.
- Added frontend auth helpers and protected-route checks.
- Added backend and frontend auth tests.
- Added authentication wiki documentation.

### Validation

- Added service, API, and frontend protected-route tests.

## 2026-05-21 - Add backend API platform foundation

### Added

- Added Python API foundation, shared contracts, React foundation, CI, and release skeleton.