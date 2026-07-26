# Dashboard sample fallbacks reduced

Issue #68 tracks replacement of dashboard and FDR sample-backed runtime data with production-backed calculations or persisted snapshots.

This release-readiness branch removes misleading runtime paths and aligns the dashboard metric repository with the migrated database contract:

- Unknown dashboard drill-down keys return an empty row set rather than a fabricated `Sample Player` / `Sample Team` result.
- `GET /api/dashboard/metrics` reads `dashboard_metric_catalog` when repository mode is PostgreSQL. An empty catalog remains empty instead of falling back to the in-memory allowlist.
- Dashboard/FDR SQLAlchemy metadata now matches migration `0007`'s `id`, `payload_json`, and `created_at` schema. The earlier typed-column metadata could pass SQLite-only tests while failing against a migrated PostgreSQL database.

## Evidence

- Existing known drill-down keys retain their deterministic rows.
- A focused API regression verifies an unknown key returns no rows and never exposes the removed sample identity.
- Deterministic metrics are explicitly labelled synthetic, seed idempotently, and round-trip through the payload table.
- The PostgreSQL workflow now runs the dashboard metric test after applying all Alembic migrations, proving the repository uses the real migration `0007` schema.

## Remaining scope

Dashboard config definitions, dimensions, filters, aggregate snapshots, drill-down facts, and FDR ratings remain sample-backed at runtime. The next slice should load the dashboard definition and widget configuration from `dashboard_definitions` in PostgreSQL mode without retaining an in-memory fallback.
