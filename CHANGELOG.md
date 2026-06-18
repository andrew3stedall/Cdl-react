# Changelog

## 2026-06-13 - Persist team selection in PostgreSQL

### Added

- Added issue #66 PostgreSQL-backed team-selection repository for lineup slot, captaincy, vice-captaincy, bench/reserve order, chip state, and fixture-lock records.
- Routed team-selection services through `RepositoryBundle.team_selection` so `CDL_REPOSITORY_MODE=postgres` uses the database-backed implementation.
- Added database-backed API tests for valid lineup persistence, invalid lineup rejection, chip persistence, invalid chip rejection, fixture summary behaviour, and factory wiring.
- Updated the team-selection PostgreSQL persistence wiki and changelog notes.

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
