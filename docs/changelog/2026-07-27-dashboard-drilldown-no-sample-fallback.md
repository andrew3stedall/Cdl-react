# Dashboard and FDR sample fallbacks reduced

Issue #68 tracks replacement of dashboard and FDR sample-backed runtime data with production-backed calculations or persisted snapshots.

This release-readiness branch removes misleading runtime paths and aligns runtime reads with migration `0007`:

- Unknown dashboard drill-down keys return an empty row set rather than fabricated sample identities.
- Dashboard metrics, configuration, filters, dimensions, widget lookup, and aggregate queries use persisted payload tables in PostgreSQL mode.
- Missing persisted dashboard data returns explicit empty or not-found responses instead of memory-backed samples.
- Dashboard drill-down uses the PostgreSQL query repository and returns no rows until a persisted fact contract exists.
- FDR combined, attack, defence, and scale routes select a PostgreSQL repository in PostgreSQL mode.
- An empty `fdr_ratings` table returns no teams, gameweeks, or rating rows instead of the in-memory Arsenal/Manchester City sample set.
- Persisted FDR reads are scoped to the requested season; ratings from another season are not exposed as current results.
- Deterministic FDR fixtures are explicitly synthetic, test-only, and idempotent.
- Dashboard/FDR SQLAlchemy metadata matches migration `0007`'s `id`, `payload_json`, and `created_at` schema.

## Evidence

- Existing sample dashboard and FDR behaviour remains available only in memory-mode preview tests.
- Dashboard repository tests prove persisted configuration and aggregate reads without fallback.
- FDR tests prove empty-before-seed behaviour, exact persisted attack/defence ratings after synthetic seeding, and explicit empty results for a season without persisted rows.
- Synthetic metric, configuration, aggregate, and FDR payloads are labelled synthetic and seed idempotently.
- The PostgreSQL workflow applies all Alembic migrations before running league, dashboard, and FDR release-path tests.

## Remaining scope

A persisted dashboard fact contract is still required before real drill-down rows can be returned. FDR calculation inputs and calculation ownership remain unimplemented; the current PostgreSQL route reads season-scoped stored ratings only. The next slice should persist and expose the FDR calculation-input/audit boundary without presenting synthetic inputs as historical evidence.
