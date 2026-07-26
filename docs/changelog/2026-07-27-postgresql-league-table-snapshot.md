# 2026-07-27 — PostgreSQL league table snapshot

## Added

- Persisted `league_table_snapshots` reads for `GET /api/league/table` in
  PostgreSQL repository mode.
- Explicit failure when PostgreSQL has no table snapshot, preventing a silent
  fixture-calculation fallback.
- Deterministic, idempotent synthetic snapshot seeding.
- Clean migrated PostgreSQL evidence for the persisted response source and row
  count.

## Safety and scope

- No migration or schema change.
- No GCP apply, Cloud SQL provisioning, deployment, secret, or public-access
  change.
- Knockout matches and head-to-head records remain later #67 increments.
