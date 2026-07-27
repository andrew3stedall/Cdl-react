# Dashboard sample fallbacks reduced

Issue #68 tracks replacement of dashboard and FDR sample-backed runtime data with production-backed calculations or persisted snapshots.

This release-readiness branch removes misleading runtime paths and aligns dashboard runtime reads with migration `0007`:

- Unknown dashboard drill-down keys return an empty row set rather than a fabricated `Sample Player` / `Sample Team` result.
- `GET /api/dashboard/metrics` reads `dashboard_metric_catalog` when repository mode is PostgreSQL. An empty catalog remains empty instead of falling back to the in-memory allowlist.
- `GET /api/dashboard/config` reads `dashboard_definitions` in PostgreSQL mode. A missing definition returns an explicit `404 not_found` response instead of silently rendering the in-memory sample dashboard.
- Dashboard widget query and drill-down routes resolve widget definitions from the persisted dashboard configuration in PostgreSQL mode. Missing configuration or widget IDs return `404` rather than consulting the sample definition.
- Dashboard widget queries read `dashboard_aggregate_snapshots` in PostgreSQL mode. Missing snapshots produce an explicit empty result instead of sample chart points.
- Dashboard/FDR SQLAlchemy metadata matches migration `0007`'s `id`, `payload_json`, and `created_at` schema.

## Evidence

- Existing known drill-down keys retain their deterministic rows in memory-mode preview tests.
- Focused API regressions verify unknown drill-down keys and absent persisted configuration do not expose sample data.
- Deterministic metrics, dashboard configuration, and aggregate snapshots are explicitly labelled synthetic, seed idempotently, and round-trip through their payload tables.
- The PostgreSQL workflow runs dashboard metric, configuration, and aggregate snapshot tests after applying all Alembic migrations, proving the repositories use the real migration `0007` schema.
- Widget queries are empty before synthetic snapshot seeding and return only the persisted, filter-matched `Castle FC` point after seeding in both SQLite and migrated PostgreSQL tests.

## Remaining scope

Dashboard dimensions and filters remain in-memory. Dashboard drill-down facts still come from the sample query repository, and FDR ratings remain sample-backed. The next slice should persist dashboard drill-down facts or explicitly disable drill-down in PostgreSQL mode until a persisted fact contract exists.
