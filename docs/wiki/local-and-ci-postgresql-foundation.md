# Local and CI PostgreSQL Foundation

## Purpose

This page documents the issue #61 database foundation for local development and CI.

Parent coordinator: #75
Parent milestone: #76
Depends on: #60

This foundation is local and CI only. It does not provision GCP, Cloud SQL, Secret Manager, Cloud Run, or production resources. Milestone #78, issue #70, and issue #71 remain blocked until Andrew confirms the manual GCP bootstrap checklist is complete.

## Local PostgreSQL

Start the local PostgreSQL service:

```bash
docker compose up -d postgres
```

Default local database URL:

```text
postgresql+psycopg://cdl:cdl@localhost:5432/cdl
```

Apply migrations:

```bash
CDL_DATABASE_URL=postgresql+psycopg://cdl:cdl@localhost:5432/cdl uv run alembic upgrade head
```

Reset local state:

```bash
docker compose down -v
docker compose up -d postgres
CDL_DATABASE_URL=postgresql+psycopg://cdl:cdl@localhost:5432/cdl uv run alembic upgrade head
```

## Alembic baseline

The baseline migration creates a `migration_probe` table. This validates that the migration system can connect to PostgreSQL and apply migrations to an empty database.

Domain tables are intentionally deferred to later persistence issues:

- #63 auth, sessions, and preferences
- #64 league and FPL cache schema
- #65 squad, transfers, and trades
- #66 team selection and chip state
- #67 fixtures, scoring, tables, and knockouts
- #68 dashboard and FDR production data
- #69 historical import tooling

## CI migration smoke workflow

The `Backend PostgreSQL` workflow starts an ephemeral PostgreSQL service and runs:

```bash
uv sync
uv run alembic upgrade head
```

The workflow is a smoke gate for migration connectivity and baseline migration application. Existing backend and frontend checks continue to run in the main CI workflow.

## Operational notes

- Keep schema migrations separate from historical data import jobs.
- Keep local credentials limited to local development.
- Do not commit production database URLs or service account keys.
- Do not start #70 or #71 until GCP bootstrap is confirmed.
