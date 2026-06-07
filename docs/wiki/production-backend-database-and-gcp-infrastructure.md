# Production Backend Database and GCP Infrastructure

## Purpose

This page summarises the issue #58 planning decision record for moving Castle Draft League toward persistent production data and deployable GCP infrastructure.

Source of truth: `docs/features/active/production-backend-database-and-gcp-infrastructure.md`.

## Decision Snapshot

| Area | Selected first production approach |
| --- | --- |
| Database | Cloud SQL for PostgreSQL |
| Migration tooling | Alembic-managed schema migrations |
| Local database | PostgreSQL via Docker Compose or equivalent local service |
| CI database | Ephemeral PostgreSQL service with migration smoke tests |
| Backend hosting | FastAPI container on Cloud Run |
| Frontend hosting | Firebase Hosting or Cloud Storage plus Cloud CDN for the static React build |
| Secrets | Secret Manager |
| Infrastructure | Declarative IaC, such as Terraform/OpenTofu-style configuration |
| Environments | Local, preview, staging, production |

## Architecture Summary

```text
Browser
  -> Static React hosting/CDN
  -> FastAPI backend on Cloud Run
  -> Cloud SQL for PostgreSQL
  -> Secret Manager for runtime credentials
  -> Cloud Logging/Monitoring/Error Reporting
```

The first production footprint should stay cost-conscious: one small production Cloud SQL PostgreSQL instance, a staging database or instance, a Cloud Run backend with explicit scaling limits, static frontend hosting, Secret Manager, logging, basic alerts, automated backups, point-in-time recovery, and a restore drill before real users are onboarded.

## Schema Domain Waves

| Wave | Domains |
| --- | --- |
| Wave 1 | Users, credentials, roles, sessions, refresh tokens, login audit, user preferences |
| Wave 2 | Leagues, seasons, draft teams, managers, memberships, permissions, FPL player/team cache |
| Wave 3 | Squad ownership, player rights, draft picks, interests, free agency, transfers, loans, trades, approvals, audit |
| Wave 4 | Lineups, captaincy, vice captaincy, bench/reserve order, chips, fixture lock state |
| Wave 5 | CDL fixtures, EPL fixtures, results, scoring snapshots, league tables, knockouts, rules versions |
| Wave 6 | Dashboard definitions, metric catalog, aggregate snapshots, FDR ratings, production calculation inputs |
| Cross-cutting | Audit events, admin actions, legacy ID mappings, import batches, archived source payloads, review items |

## Environment Strategy

| Environment | Role |
| --- | --- |
| Local | Developer work with local PostgreSQL, reset/migrate/seed commands, and local FastAPI/Vite servers. |
| Preview | PR or review validation using seeded preview data once the risk is accepted. |
| Staging | Production rehearsal with isolated database credentials, migrations, deploys, smoke checks, and restore drills. |
| Production | Real-user environment with isolated Cloud SQL, runtime secrets, monitoring, backups, rollback, and least-privilege IAM. |

## Follow-Up Issue Register

Planned follow-up work should be split into small implementation issues:

1. Database architecture decision record.
2. Local and CI PostgreSQL foundation.
3. Backend database settings and repository factory.
4. Auth/session/preference persistence.
5. Core league and FPL cache schema.
6. Squad, transfers, and trades persistence.
7. Team-selection and chip persistence.
8. Fixture, scoring, table, and knockout persistence.
9. Dashboard and FDR production data.
10. Legacy import and backfill tooling.
11. GCP infrastructure bootstrap.
12. Production deployment and go-live checklist.

## Operational Gates

Before real users are onboarded, the production path must have:

- Automated Cloud SQL backups and point-in-time recovery.
- A documented and exercised staging restore drill.
- Secret Manager-backed runtime configuration.
- Least-privilege service accounts for deploy, runtime, migration, and diagnostics.
- Cloud Run scaling limits sized against Cloud SQL connection capacity.
- Backend and frontend smoke tests after staging and production deploys.
- Alerts for backend 5xx rate, latency, Cloud SQL CPU/storage/connections, failed backups, and failed migration jobs.
- A rollback plan that keeps the previous Cloud Run revision and compatible migration state visible.

## Validation

The repository includes documentation tests that verify the selected database, hosting pattern, migration tooling, secrets strategy, environment plan, schema domains, and follow-up issue register remain visible.

## Maintenance Rules

- Keep the active feature document in `docs/features/active/` until the planning issue is accepted and follow-up implementation issues are created or linked.
- Update this wiki page when the database service, hosting model, environment strategy, or follow-up sequencing changes.
- Update affected active feature documents when persistence ownership or schema waves change.
- Do not treat this planning document as proof that any GCP resource or production database has been provisioned.
