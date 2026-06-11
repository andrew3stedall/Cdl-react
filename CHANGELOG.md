# Changelog

## 2026-06-10 - Persist auth sessions and user preferences

### Added

- Added issue #63 PostgreSQL persistence for users, sessions, and user preferences.
- Added an append-only `0002_auth_preferences` migration after the #61 baseline migration.
- Added PostgreSQL-backed auth/session and preference repositories.
- Wired `postgres` repository mode through the repository factory while preserving default `memory` mode.
- Added wiki documentation for auth/session/preference tables, repository modes, and the #64 handoff.

### Validation

- Added tests for PostgreSQL identity/session repositories and documentation coverage for the migration, factory handoff, and GCP gate.

## 2026-06-10 - Add backend database settings and repository factory

### Added

- Added issue #62 backend database settings for repository mode, database URL, pool size, max overflow, and environment naming.
- Added a repository factory and `RepositoryBundle` to centralise backend repository construction.
- Routed auth service construction through the repository factory while preserving current in-memory API behaviour.
- Added wiki documentation for repository modes, environment variables, and the #63 handoff.

### Validation

- Added tests for database settings, memory repository construction, guarded PostgreSQL mode, and documentation handoff coverage.

## 2026-06-07 - Add production persistence ADR

### Added

- Added the issue #60 production persistence architecture decision record.
- Confirmed Cloud SQL for PostgreSQL, Alembic-managed migrations, local/CI PostgreSQL, and a settings-driven repository factory as the first production persistence path.
- Documented deferred database alternatives and the dependency handoff to #61 and #62.
- Updated the production database/GCP wiki with the ADR path and the #78 GCP bootstrap gate.

### Validation

- Added documentation tests for the issue #60 feature document, production persistence ADR, deferred alternatives, wiki ADR link, and GCP gate.

## 2026-06-07 - Plan production backend database and GCP infrastructure

### Added

- Added a production database and GCP infrastructure planning feature document for issue #58.
- Selected Cloud SQL for PostgreSQL, Alembic migrations, Cloud Run backend hosting, static React hosting, Secret Manager, declarative infrastructure, and local/preview/staging/production environments.
- Mapped production schema domains to current active feature documents and persistence implementation waves.
- Added a draft follow-up issue register for database foundation, repository persistence, legacy import/backfill, GCP bootstrap, and production go-live readiness.
- Added wiki documentation summarising the production infrastructure decisions and operational gates.

### Validation

- Added documentation tests that verify the selected platform decisions, environment strategy, schema domains, follow-up issue register, and wiki operational gates remain visible.
- Kept `docs/features/active/production-backend-database-and-gcp-infrastructure.md` active until the planning issue is accepted and follow-up implementation issues are created or linked.

## 2026-05-23 - Refresh parallel development coordination

### Changed

- Updated the parallel development coordination source document with issue mappings for Agent 01 through Agent 10.
- Added current foundation status for each active feature workflow.
- Added a shared contract register covering session, API error, route, theme preset, shared model, and legacy migration ownership.
- Added release coordination rules for keeping active feature documents aligned until a deliberate release-management pass.
- Added wiki documentation for parallel development coordination guardrails.

### Validation

- Added documentation tests for workflow issue mappings, shared contract ownership, cross-feature matrix coverage, coordination wiki content, and repository operating-doc references.
- Kept `docs/features/active/parallel-development-coordination.md` active until release coordination is complete.

## 2026-05-23 - Refresh legacy migration feature index

### Changed

- Updated the legacy migration feature index to mark Analytics Dashboard and Fixture Difficulty Ratings as implemented foundations instead of unimplemented planning gaps.
- Added latest re-review notes for Dashboard and FDR route/API coverage while retaining sample-backed data and calculation migration gaps.
- Added a migration risk covering divergence between sample-backed Dashboard/FDR repositories and production legacy calculations.
- Refreshed the legacy migration index wiki to match current route/API coverage.

### Validation

- Extended documentation tests to verify Dashboard and FDR are no longer marked as unimplemented in the active migration index.
- Extended documentation tests to verify the wiki reflects the current Dashboard/FDR migration status.
- Kept `docs/features/active/legacy-migration-feature-index.md` active until legacy migration coverage is complete.

## 2026-05-23 - Implement fixture difficulty ratings

### Added

- Added FDR contracts for attack/defence views, team rows, fixture cells, filters, rating bands, and accessible rating scale tokens.
- Added in-memory FDR repository and `FixtureDifficultyService` for attack and defence retrieval, team/gameweek filtering, average rating calculation, and rating scale exposure.
- Added API routes for `GET /api/fdr`, `GET /api/fdr/attack`, `GET /api/fdr/defence`, and `GET /api/fdr/scales`.
- Added `/fdr` React route inside the shared shell with team and gameweek filters, attack and defence dense tables, sticky team columns, responsive horizontal scrolling, and rating legend.
- Added wiki documentation for FDR calculation ownership, API syntax, rating scale examples, and theme preset integration.

### Validation

- Added backend service tests for combined responses, team/gameweek filters, sorted average ratings, and accessible scale tokens.
- Added backend API integration tests for combined FDR, attack/defence filters, and rating scale endpoints.
- Added frontend tests for FDR rendering, filter re-query behaviour, token-driven rating classes, and shell/session route behaviour.
- Feature document remains under `docs/features/active/` until CI validation passes.

## 2026-05-23 - Implement analytics dashboard

### Added

- Added analytics dashboard contracts for dashboard config, metrics, dimensions, filters, widget definitions, widget query requests, chart series, table rows, and drill-down responses.
- Added in-memory dashboard repository and service boundaries for metric catalog validation, widget configuration, filtered aggregations, and drill-down rows.
- Added API routes for `GET /api/dashboard/config`, `POST /api/dashboard/widgets/{widget_id}/query`, `POST /api/dashboard/widgets/{widget_id}/drilldown`, `GET /api/dashboard/filters`, `GET /api/dashboard/metrics`, and `GET /api/dashboard/dimensions`.
- Added `/dashboard` React route inside the shared shell with global filters, responsive widget grid, accessible chart bars, fallback tables, and drill-down dialog.
- Added wiki documentation for dashboard configuration syntax, catalog allowlists, query examples, and UI behaviour.

### Validation

- Added backend service tests for catalog/config exposure, filtered widget queries, filter validation, and drill-down context.
- Added backend API integration tests for config/catalog endpoints, widget query validation, drill-down rows, and missing-widget errors.
- Added frontend tests for dashboard rendering, filter re-query behaviour, drill-down flows, and shell/session route behaviour.

## 2026-05-22 - Maintain legacy migration feature index

### Added

- Expanded the legacy migration feature index with a current coverage matrix for reviewed legacy screens, active feature documents, modern route/API coverage, implementation status, and migration risks.
- Added missing-feature candidate tracking for commissioner administration, notifications, import/export tooling, and additional reports discovered during future legacy re-review.
- Added a migration risk register covering undocumented PHP endpoint shapes, JavaScript-encoded business logic, rule-copy drift, browser-local state, and database-view coupling.
- Added legacy migration index wiki documentation.

### Validation

- Added documentation tests that verify reviewed legacy entry points remain listed.
- Added documentation tests that verify all major active feature documents remain mapped.
- Added documentation tests that verify missing-feature candidates and migration risks remain tracked.
- Kept `docs/features/active/legacy-migration-feature-index.md` active until legacy migration coverage is complete.

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
