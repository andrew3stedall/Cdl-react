# Dashboard sample fallbacks reduced

Issue #68 tracks replacement of dashboard and FDR sample-backed runtime data with production-backed calculations or persisted snapshots.

This release-readiness branch now removes two misleading runtime paths:

- Unknown dashboard drill-down keys return an empty row set rather than a fabricated `Sample Player` / `Sample Team` result.
- `GET /api/dashboard/metrics` reads `dashboard_metric_catalog` when repository mode is PostgreSQL. An empty catalog remains empty instead of falling back to the in-memory allowlist.

## Evidence

- Existing known drill-down keys retain their deterministic rows.
- A focused API regression verifies an unknown key returns no rows and never exposes the removed sample identity.
- A repository-backed API test proves an empty PostgreSQL catalog returns no metrics.
- Deterministic metrics are explicitly labelled synthetic, seed idempotently, and round-trip through the migrated table.

## Remaining scope

Dashboard config definitions, dimensions, filters, aggregate snapshots, drill-down facts, and FDR ratings remain sample-backed at runtime. The next slice should load the dashboard definition and widget configuration from `dashboard_definitions` in PostgreSQL mode without retaining an in-memory fallback.
