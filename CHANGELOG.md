# Changelog

## 2026-07-27 - Prepare the single-service staging runtime

### Added

- Added a multi-stage container build that packages the React application and FastAPI API in one immutable image.
- Added FastAPI static asset and SPA fallback handling without masking unknown `/api` routes.
- Added Terraform support for PostgreSQL repository mode, Secret Manager environment references and secure staging cookies.
- Narrowed the runtime identity to the database URL and staging login secret containers it consumes.
- Added an ADR defining the one-URL Cloud Run architecture and its separately gated apply, migration, seed and public-access sequence.

### Validation

- Added focused API, frontend-serving, Dockerfile and Terraform contract tests.
- Kept Cloud Run disabled by default and made no GCP apply, secret version, database mutation, deployment or public-access change.

## 2026-07-27 - Add staging observability and cost attribution

### Added

- Added bounded Cloud SQL and conditional Cloud Run alert policies without creating notification recipients.
- Added shared application, environment, management and component labels to chargeable staging resources.
- Added an operator runbook covering alert response, cost-label verification and live-action gates.

### Validation

- Added Terraform contract tests for alert safety, notification boundaries and cost-attribution labels.
- Kept Terraform apply, public access, credentials, billing exports and production changes outside this repository-only step.

## 2026-07-27 - Prove PostgreSQL fixture result parity

### Added

- Expanded deterministic synthetic fixture seeding with completed away-win and draw outcomes.
- Added a four-case parity matrix for pending, started home-win, completed away-win, and completed draw states.

### Validation

- Verified the matrix through the PostgreSQL repository and the existing league fixtures API.
- Extended clean-database row-count assertions for seven persisted CDL fixtures, results, and scoring snapshots.

## 2026-07-27 - Persist EPL fixture scoring context

### Added

- Linked deterministic `epl_fixtures` rows from persisted CDL scoring snapshots.
- Exposed typed EPL fixture provenance through the existing league fixture score contract.
- Added an explicit repository error for broken persisted EPL scoring links.

### Validation

- Added idempotent SQLite coverage for EPL scoring context and broken-link rejection.
- Extended the clean migrated PostgreSQL API journey to verify synthetic EPL provenance and all seven #67 runtime tables.

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
