# 2026-07-27 — PostgreSQL knockout persistence

## Added

- Persisted `knockout_matches` reads for `GET /api/league/knockout` in
  PostgreSQL repository mode.
- Explicit failures for absent knockout rows and broken persisted fixture links,
  preventing fixture-label derivation in the release path.
- Deterministic, idempotent synthetic knockout seeding.
- Clean migrated PostgreSQL evidence for knockout rounds, fixture linkage, and
  stored-row count.

## Safety and scope

- No migration or schema change.
- No GCP, Terraform, deployment, secret, or public-access change.
- Head-to-head records remain a later #67 increment.
