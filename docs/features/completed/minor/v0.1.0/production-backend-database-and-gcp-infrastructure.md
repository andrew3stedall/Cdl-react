# Feature: Production Backend Database and GCP Infrastructure

## Purpose

Record the completed issue #58 planning outcome for moving Castle Draft League from sample-backed data toward persistent production data and deployable GCP hosting.

This completed feature is a planning record only. It does not implement a production database, provision cloud resources, import historical data, or replace the existing sample repositories.

## Status

Completed planning record. Implementation is split into follow-up issues #60 through #71.

## Release Target

Minor planning release `v0.1.0`.

## Source of Truth

- Planning issue: #58
- Merged PR: #59
- Completed feature document: `docs/features/completed/minor/v0.1.0/production-backend-database-and-gcp-infrastructure.md`
- Wiki page: `docs/wiki/production-backend-database-and-gcp-infrastructure.md`
- Release document: `docs/releases/v0.1.0.md`
- Related platform document: `docs/features/active/backend-api-data-platform.md`
- Related migration index: `docs/features/active/legacy-migration-feature-index.md`

## Decision Summary

| Area | Decision |
| --- | --- |
| Primary database | Cloud SQL for PostgreSQL |
| Local database | PostgreSQL in Docker Compose or equivalent local service |
| Test database | Ephemeral PostgreSQL service in CI |
| Migration tooling | Alembic-managed schema migrations |
| Backend hosting | Cloud Run service for the FastAPI container |
| Frontend hosting | Static React build on Firebase Hosting or Cloud Storage plus Cloud CDN |
| Runtime configuration | Secret Manager |
| Infrastructure as code | Terraform/OpenTofu-style declarative configuration |
| Initial environments | Local, preview, staging, production |

## Current Behaviour Captured

- Backend foundations use FastAPI, Pydantic contracts, service classes, and repository boundaries.
- Authentication currently uses in-memory user and session repositories.
- Squad and team-selection data currently come from in-memory repositories with sample players, teams, fixtures, lineups, and chip state.
- Dashboard and FDR have modern route/API foundations, but remain sample-backed until stable production calculations or production-backed snapshots are migrated.
- This feature is planning-only; implementation remains open in the follow-up issues.

## Schema Domain Waves

| Wave | Domains |
| --- | --- |
| Wave 1 | Users, roles, sessions, refresh tokens, login audit, user preferences |
| Wave 2 | Leagues, seasons, draft teams, managers, memberships, permissions, FPL player/team cache |
| Wave 3 | Squad ownership, player rights, draft picks, interests, free agency, transfers, loans, trades, approvals, audit |
| Wave 4 | Lineups, captaincy, vice captaincy, bench/reserve order, chips, fixture lock state |
| Wave 5 | CDL fixtures, EPL fixtures, results, scoring snapshots, league tables, knockouts, rules versions |
| Wave 6 | Dashboard definitions, metric catalog, aggregate snapshots, FDR ratings, production calculation inputs |
| Cross-cutting | Audit events, admin actions, source ID mappings, import batches, archived source payloads, review items |

## Environment Strategy

| Environment | Role |
| --- | --- |
| Local | Developer work with local PostgreSQL, reset/migrate/seed commands, and local FastAPI/Vite servers. |
| Preview | PR or review validation using seeded preview data once the risk is accepted. |
| Staging | Production rehearsal with isolated database setup, migrations, deploys, smoke checks, and restore drills. |
| Production | Real-user environment with isolated Cloud SQL, runtime configuration, monitoring, backups, rollback, and least-privilege IAM. |

## Follow-Up Issue Register

| Issue | Scope |
| --- | --- |
| #60 | Database architecture decision record. |
| #61 | Local and CI PostgreSQL foundation. |
| #62 | Backend database settings and repository factory. |
| #63 | Auth/session/preference persistence. |
| #64 | Core league and FPL cache schema. |
| #65 | Squad, transfers, and trades persistence. |
| #66 | Team-selection and chip persistence. |
| #67 | Fixture, scoring, table, and knockout persistence. |
| #68 | Dashboard and FDR production data. |
| #69 | Data import tooling for historical CDL data. |
| #70 | GCP infrastructure bootstrap for staging. |
| #71 | Production deployment and go-live checklist. |

## Operational Gates

Before real users are onboarded, the production path must have:

- Automated Cloud SQL backups and point-in-time recovery.
- A documented and exercised staging restore drill.
- Managed runtime configuration.
- Least-privilege service accounts for deploy, runtime, migration, and diagnostics.
- Cloud Run scaling limits sized against Cloud SQL connection capacity.
- Backend and frontend smoke tests after staging and production deploys.
- Alerts for backend 5xx rate, latency, Cloud SQL CPU/storage/connections, failed backups, and failed migration jobs.
- A rollback plan that keeps the previous Cloud Run revision and compatible migration state visible.

## Acceptance Criteria

- Cloud SQL for PostgreSQL is selected as the first production database service.
- Cloud Run is selected as the first backend hosting service.
- Static React hosting through Firebase Hosting or Cloud Storage plus Cloud CDN is selected for the frontend.
- Local, preview, staging, and production environments are defined.
- Initial schema domains are mapped to repository replacement waves.
- Migration, seed, backup, restore, PITR, local development, and CI test database expectations are documented.
- IAM, CORS, cookie/session security, deployment, monitoring, and cost controls are documented.
- Follow-up issues #60 through #71 are opened.
- This issue remains planning-only and does not provision GCP resources or replace repositories.

## Test Requirements

- Documentation tests verify the selected database, backend hosting, frontend hosting, runtime configuration, migration tooling, and environment strategy remain documented.
- Documentation tests verify schema domains and follow-up issue links remain visible.
- Future implementation issues must add unit tests, repository tests, API integration tests, frontend tests where applicable, migration smoke tests, lint/format checks, and build validation.

## Completion Checklist

- [x] Production database service selected.
- [x] GCP backend/frontend hosting pattern selected.
- [x] Environment strategy documented.
- [x] Schema domains mapped to active features.
- [x] Migration, local, CI, backup, restore, runtime configuration, and monitoring requirements documented.
- [x] Follow-up issue register drafted.
- [x] Follow-up implementation issues opened: #60 through #71.
- [x] Wiki documentation added.
- [x] Documentation tests added.
- [x] Changelog updated.
- [x] Planning issue #58 closed by merged PR #59.
- [x] Feature document moved to completed planning release folder.

## Remaining Implementation Work

Production database and GCP implementation is not complete. It remains tracked by issues #60 through #71.
