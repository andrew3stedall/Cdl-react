# Dashboard and FDR production data

Issue #68 adds the PostgreSQL schema foundation for dashboard definitions, dashboard metric catalog entries, aggregate snapshots, fixture difficulty ratings, and FDR calculation inputs.

## Scope

- `dashboard_definitions` stores dashboard layout and widget definitions as versioned JSON.
- `dashboard_metric_catalog` stores the server-owned metric allowlist.
- `dashboard_aggregate_snapshots` stores calculated metric outputs by dimension and gameweek.
- `fdr_ratings` stores attack and defence fixture difficulty ratings by team, opponent, gameweek, and venue.
- `fdr_calculation_inputs` stores versioned inputs and audit metadata used to reproduce ratings.

Migration `0007_dashboard_fdr_production_data` follows `0006_league_fixture_scoring_persistence`.

## FDR calculation ownership

`FixtureDifficultyCalculationService` is the only owner of converting a persisted `fdr-input/v1` contract into rating rows. It:

1. loads one season-scoped calculation run;
2. validates the contract and algorithm versions;
3. validates fixture count and recomputes the canonical SHA-256 input digest;
4. deterministically maps attack and defence scores to ratings and bands;
5. links every rating to the calculation run, algorithm version, and timestamp;
6. inserts missing ratings, accepts exact idempotent reruns, and rejects conflicting rows.

The PostgreSQL read repository fails closed: ratings with a missing, wrong-season, or algorithm-mismatched calculation run are not returned. The current deterministic fixture contract is synthetic and test-only; it is not evidence of historical results.

Dashboard calculation ownership remains server-side through persisted definitions and snapshots. Dashboard drill-down returns no rows in PostgreSQL mode until a persisted fact contract is available.

In staging, the dashboard CDL-team dimension and filter options are resolved from the
`league-cdl-2026-27` draft teams. Aggregate points for unrelated legacy demo teams are filtered
out, so the dashboard displays an honest empty state until current-season metric snapshots are
calculated.
