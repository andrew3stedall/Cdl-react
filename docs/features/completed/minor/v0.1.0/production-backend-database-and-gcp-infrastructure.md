# Feature: Production Backend Database and GCP Infrastructure

## Purpose

Record the completed issue #58 planning outcome for the production database and GCP infrastructure path.

This is a planning record only. Production database and GCP implementation is not complete.

## Status

Completed planning record. Implementation is split into follow-up issues #60 through #71.

## Source of Truth

- Planning issue: #58
- Merged PR: #59
- Release document: `docs/releases/v0.1.0.md`
- Wiki page: `docs/wiki/production-backend-database-and-gcp-infrastructure.md`

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
| Local | Developer work with local PostgreSQL and local FastAPI/Vite servers. |
| Preview | PR or review validation using seeded preview data once the risk is accepted. |
| Staging | Production rehearsal with isolated database setup, migrations, deploys, smoke checks, and staging restore drill. |
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

## Remaining Implementation Work

Production database and GCP implementation is not complete. It remains tracked by issues #60 through #71.
