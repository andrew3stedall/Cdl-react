# Changelog

## 2026-06-07 - Finalise production backend database and GCP planning

### Changed

- Moved the issue #58 planning record into the completed minor release folder for `v0.1.0`.
- Linked the final production persistence and GCP implementation register to follow-up issues #60 through #71.
- Updated the production infrastructure wiki to point at the completed planning record.
- Updated release documentation for the issue #58 planning finalisation.

### Validation

- Updated documentation tests to verify the completed planning record links issue #58, PR #59, release documentation, and the implementation issue register.
- Kept production database and GCP implementation explicitly open in follow-up issues #60 through #71.

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
