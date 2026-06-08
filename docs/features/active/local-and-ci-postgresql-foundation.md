# Feature: Local and CI PostgreSQL Foundation

## Purpose

Implement issue #61 by adding the local and CI database foundation needed before production repositories are implemented.

This feature follows the production persistence ADR in #60 and milestone issue #76.

## Status

Active implementation feature for issue #61.

Parent coordinator: #75
Parent milestone: #76
Depends on: #60

## Scope

- Add a local PostgreSQL service for developer use.
- Add Alembic configuration and a baseline migration smoke target.
- Add CI PostgreSQL service support.
- Add migration smoke tests that prove migrations can run against an empty PostgreSQL database.
- Document reset, migrate, and seed expectations.

## Out of Scope

- GCP provisioning.
- Cloud SQL provisioning.
- Secret Manager setup.
- Replacing domain repositories.
- Historical import tooling.
- Starting #78, #70, or #71.

## Local PostgreSQL

Local development uses Docker Compose with PostgreSQL 16.

Default local connection URL:

```text
postgresql+psycopg://cdl:cdl@localhost:5432/cdl
```

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Apply migrations:

```bash
CDL_DATABASE_URL=postgresql+psycopg://cdl:cdl@localhost:5432/cdl uv run alembic upgrade head
```

Reset local data:

```bash
docker compose down -v
docker compose up -d postgres
CDL_DATABASE_URL=postgresql+psycopg://cdl:cdl@localhost:5432/cdl uv run alembic upgrade head
```

## CI PostgreSQL

The backend CI job should run with an ephemeral PostgreSQL service and set `CDL_DATABASE_URL` before pytest.

CI migration smoke tests must run against PostgreSQL. Unit tests that do not need a database may continue using in-memory repositories.

## Alembic Baseline

This feature adds Alembic configuration and a baseline migration probe table. The probe table is intentionally small and only validates the migration path.

Domain tables are left for #63 through #69.

## Handoff to #62

#62 should use this foundation to add typed database settings and repository factory selection. It should not reselect the database or migration tooling.

## Acceptance Criteria

- Local PostgreSQL setup is documented and runnable.
- Reset, migrate, and seed commands are documented.
- CI runs against an ephemeral PostgreSQL service.
- Alembic baseline migration support is available.
- Migration smoke tests apply all migrations to an empty database.
- Documentation and changelog are updated.
- #78 remains blocked until Andrew confirms GCP bootstrap completion.
