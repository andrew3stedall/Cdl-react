# Dashboard and FDR production data

Issue #68 adds the PostgreSQL schema foundation for dashboard definitions, dashboard metric catalog entries, aggregate snapshots, fixture difficulty ratings, and FDR calculation inputs.

## Scope

- `dashboard_definitions` stores dashboard layout and widget definitions as versioned JSON.
- `dashboard_metric_catalog` stores the server-owned metric allowlist.
- `dashboard_aggregate_snapshots` stores calculated metric outputs by dimension and gameweek.
- `fdr_ratings` stores attack and defence fixture difficulty ratings by team, opponent, gameweek, and venue.
- `fdr_calculation_inputs` stores captured inputs used to reproduce ratings.

Migration `0007_dashboard_fdr_production_data` follows `0006_league_fixture_scoring_persistence`.

Calculation ownership remains server-side. Runtime repositories can switch from sample-backed calculations to these persisted snapshots once import coverage is available.
