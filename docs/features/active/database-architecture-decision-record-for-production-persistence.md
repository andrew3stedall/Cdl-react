# Feature: Database Architecture Decision Record for Production Persistence

## Purpose

Finalise issue #60 by turning the production persistence planning outcome from #58 into a focused database architecture decision record.

This feature does not provision infrastructure, add migrations, or replace repositories. It records the database, migration, environment, repository factory, and deferred alternative decisions required before #61 and #62 begin.

## Status

Active implementation feature for issue #60.

Parent coordinator: #75
Parent milestone: #76

## Scope

- Confirm Cloud SQL for PostgreSQL as the first managed production database service.
- Confirm local PostgreSQL and CI PostgreSQL expectations.
- Confirm Alembic-managed schema migrations as the versioning mechanism.
- Confirm the repository factory approach for switching between in-memory and PostgreSQL-backed repositories.
- Document deferred alternatives and why they are not first-version choices.
- Document handoff requirements for #61 and #62.

## Out of Scope

- Creating a local PostgreSQL Docker Compose setup.
- Adding Alembic files or database migrations.
- Provisioning Cloud SQL or any GCP resource.
- Replacing auth, league, squad, lineup, fixture, dashboard, or FDR repositories.
- Importing historical CDL data.

## Decisions

| Area | Decision | Rationale | Downstream issue |
| --- | --- | --- | --- |
| Managed production database | Cloud SQL for PostgreSQL | Relational integrity, transactions, joins, backups, restore tooling, local parity, and Python ecosystem support fit CDL domain data. | #70 |
| Local database | PostgreSQL via Docker Compose or equivalent local service | Local development should exercise PostgreSQL constraints and query behaviour before CI or staging. | #61 |
| CI database | Ephemeral PostgreSQL service | Migration smoke tests and repository tests must run against PostgreSQL, not only mocks. | #61 |
| Migration tooling | Alembic-managed schema migrations | Alembic fits the Python/FastAPI stack and provides reviewable schema versioning. | #61 |
| Repository construction | Settings-driven repository factory | The backend must support in-memory repositories for current demo/test paths while introducing PostgreSQL-backed implementations incrementally. | #62 |
| Transaction ownership | Service or unit-of-work boundary coordinates transactions; repositories own persistence details | Domain services should keep validation/orchestration separate from SQL access. | #62 through #69 |
| Secret handling | Database URLs and credentials come from environment-specific settings and Secret Manager once deployed | Secrets must not be committed or embedded in frontend builds. | #62 and #70 |
| First schema waves | Keep the #58 wave order: identity/preferences, league/FPL cache, squad/trades, lineup/chips, fixtures/scoring, dashboard/FDR, imports/audit | Keeps implementation incremental and aligned with existing feature ownership. | #63 through #69 |

## Repository Factory Requirements

The #62 repository factory should provide a single backend composition point for selecting repository implementations.

Required properties:

- A typed setting for repository mode, such as `memory` or `postgres`.
- A typed database URL setting used only by server-side code.
- Test override support so API and service tests can opt into memory or PostgreSQL-backed repositories explicitly.
- No raw SQL in FastAPI route handlers.
- Repository classes or adapters own database queries.
- Service classes keep domain validation and orchestration responsibilities.
- Current API response shapes remain stable unless their owning feature documents are updated.

## Migration Requirements

The #61 migration foundation should provide:

- Alembic configuration under the backend project.
- A project command or documented command for applying all migrations to an empty database.
- A migration smoke test in CI.
- A deterministic local reset/migrate/seed path.
- Clear separation between schema migrations and later historical import/backfill jobs.

## Environment Requirements

| Environment | Database expectation |
| --- | --- |
| Local | Developer-owned PostgreSQL database with reset, migrate, and seed commands. |
| CI | Ephemeral PostgreSQL service with migration smoke tests before repository tests. |
| Staging | Isolated Cloud SQL PostgreSQL target once #70 starts, after GCP bootstrap is confirmed. |
| Production | Isolated Cloud SQL PostgreSQL target with backups, point-in-time recovery, restore drill, monitoring, and least-privilege access before real users. |

## Deferred Alternatives

| Alternative | Deferred because |
| --- | --- |
| Firestore | CDL data has relational constraints, joins, transactions, and reporting needs that fit PostgreSQL better for the first production version. |
| AlloyDB | Operationally stronger than needed for the first small production footprint and higher cost/complexity than Cloud SQL. |
| Spanner | Unnecessary scale and complexity for expected early CDL usage. |
| BigQuery-first storage | Useful for analytics later, but not a transactional application database. |
| SQLite-only production or local workflow | Does not give enough parity with production PostgreSQL constraints, concurrency, and migrations. |
| Manual SQL changes | Does not provide the required reviewable schema versioning and migration audit trail. |

## Dependencies

- Depends on completed planning record #58 and PR #59.
- Coordinates through #75.
- Belongs to milestone issue #76.
- Unblocks #61 and #62.
- Does not unblock #78 until Andrew confirms manual GCP bootstrap completion.

## Acceptance Criteria

- The database decision record confirms Cloud SQL for PostgreSQL.
- Alembic is confirmed as the migration/versioning mechanism.
- Local, CI, staging, and production database expectations are documented.
- The repository factory approach is documented.
- Deferred alternatives are documented with rationale.
- The #78 GCP milestone remains blocked until manual GCP bootstrap is confirmed.
- Wiki, changelog, and documentation tests are updated.
