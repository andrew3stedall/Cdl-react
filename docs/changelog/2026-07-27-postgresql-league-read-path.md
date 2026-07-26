# 2026-07-27 — PostgreSQL league fixture read path

## Added

- Settings-driven PostgreSQL repository wiring for every primary `/api/league`
  endpoint.
- Persisted fixture identity, result, and scoring-snapshot reconstruction.
- Explicitly synthetic, deterministic, idempotent fixture seed payloads.
- Clean migrated PostgreSQL API coverage for current, started, and pending
  fixtures plus calculated standings.

## Safety and scope

- No migration or schema change.
- No GCP apply, Cloud SQL provisioning, deployment, secret, or public-access
  change.
- Persisted table snapshots, knockout matches, and head-to-head records remain
  a later #67 increment.
