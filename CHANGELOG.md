# Changelog

## 2026-06-12 - Add squad transfer and trade schema

### Added

- Added issue #65 PostgreSQL schema for squad player rights, roster slots, draft picks, interests, free-agent claims, transfer proposals, trade proposals, trade assets, approvals, and audit events.
- Added append-only `0004_squad_transfer_trade_state` migration after the #64 core league and FPL cache schema.
- Added PostgreSQL metadata for the squad transfer and trade table set.
- Added wiki documentation for the #65 schema and handoff.

### Validation

- Added tests for the expected squad transfer/trade table set and migration dependency on `0003_core_league_fpl_cache`.

## 2026-06-11 - Add core league and FPL cache schema

### Added

- Added issue #64 PostgreSQL schema for leagues, seasons, draft teams, managers, memberships, permissions, EPL teams, FPL positions, FPL players, values, availability, and cache freshness.
- Added append-only `0003_core_league_fpl_cache` migration after the #63 auth/session/preference migration.
- Added PostgreSQL metadata for the core league and FPL cache table set.
- Added wiki documentation for the #64 schema and handoff.

### Validation

- Added tests for the expected table set and migration dependency on `0002_auth_preferences`.

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

- Added documentation tests for workflow issue mappings, shared contract ownership, coordination wiki content, and repository operating-doc references.
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
