# Changelog

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

### Validation

- Added backend and frontend foundation tests.
