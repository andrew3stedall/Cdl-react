# Production Persistence Architecture Decision Record

## Status

Accepted for first production implementation.

Issue: #60
Coordinator: #75
Milestone issue: #76

## Context

Castle Draft League currently has production-shaped API and UI foundations, but the major backend data paths still rely on in-memory or sample-backed repositories. The completed planning record in #58 selected the production direction and split the work into #60 through #71.

This ADR narrows that planning result into decisions that #61 and #62 can implement without reopening the database architecture question.

## Decision

Use **Cloud SQL for PostgreSQL** as the first managed production database service.

Use **PostgreSQL locally** and in **CI** so migrations and repository tests exercise production-like constraints.

Use **Alembic-managed schema migrations** for schema versioning.

Use a **settings-driven repository factory** to allow the backend to keep current in-memory repositories while PostgreSQL-backed repositories are introduced incrementally.

## Required environment model

| Environment | Database expectation |
| --- | --- |
| Local | Developer PostgreSQL database with documented reset, migrate, and seed commands. |
| CI | Ephemeral PostgreSQL service that applies migrations to an empty database before repository tests. |
| Staging | Isolated Cloud SQL PostgreSQL target after Andrew confirms manual GCP bootstrap is complete. |
| Production | Isolated Cloud SQL PostgreSQL target with backups, point-in-time recovery, restore drill, monitoring, rollback notes, and least-privilege access before real users. |

## Repository factory decision

#62 should add a backend composition point that selects repository implementations from typed settings.

The initial modes should be:

- `memory` for existing tests, demos, and compatibility while migrations roll forward.
- `postgres` for database-backed repositories introduced by #63 through #69.

The factory must keep SQL out of route handlers. FastAPI routes should continue depending on services. Services should own domain validation and orchestration. Repository classes should own persistence details.

## Migration decision

#61 should add Alembic as the schema migration mechanism and provide a migration smoke test that applies every migration to an empty PostgreSQL database.

Schema migrations and historical import jobs must remain separate. Historical import tooling belongs to #69.

## First schema wave order

1. Identity, sessions, roles, login audit, and preferences.
2. League, season, draft team, manager, membership, permission, and FPL reference cache.
3. Squad ownership, player rights, transfers, loans, trades, approvals, and audit state.
4. Lineups, captaincy, bench/reserve order, chips, and fixture lock state.
5. Fixtures, results, scoring snapshots, league tables, knockouts, and head-to-head state.
6. Dashboard definitions, metrics, aggregate snapshots, FDR ratings, and production calculation inputs.
7. Cross-cutting audit, import batches, source ID mappings, archived payloads, and review items.

## Deferred alternatives

| Alternative | Reason deferred |
| --- | --- |
| Firestore | The first production model needs relational constraints, joins, transactions, and reporting-friendly schema design. |
| AlloyDB | More operational capability and cost than required for the first production footprint. |
| Spanner | Unnecessary scale and complexity for expected early usage. |
| BigQuery-first storage | Useful for later analytics, but not a transactional application store. |
| SQLite-only workflow | Insufficient production parity for PostgreSQL constraints, migrations, and concurrency. |
| Manual SQL changes | Lacks reviewable migration history and release gating. |

## Consequences

- #61 can implement local and CI PostgreSQL with Alembic without reselecting the database technology.
- #62 can implement typed database settings and repository selection without replacing every repository at once.
- #63 through #69 can migrate one domain at a time while preserving current API contracts.
- #70 and #71 remain blocked until the manual GCP bootstrap checklist is confirmed by Andrew.
