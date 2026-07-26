# Dashboard drill-down no longer fabricates sample rows

Issue #68 tracks replacement of dashboard and FDR sample-backed runtime data with production-backed calculations or persisted snapshots.

This bounded release-readiness change removes the dashboard repository's silent fallback row for unknown drill-down keys. Unknown keys now return an empty row set rather than a fabricated `Sample Player` / `Sample Team` result.

## Evidence

- Existing known drill-down keys retain their deterministic rows.
- A focused API regression test verifies an unknown key returns no rows and never exposes the removed sample identity.

## Remaining scope

Dashboard definitions, metric catalog entries, aggregate snapshots, drill-down facts, and FDR ratings still need PostgreSQL runtime wiring under #68. The next slice should route dashboard metric catalog reads through `dashboard_metric_catalog` in PostgreSQL mode without retaining an in-memory fallback.
