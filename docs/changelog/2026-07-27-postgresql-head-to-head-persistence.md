# 2026-07-27 — PostgreSQL head-to-head persistence

## Added

- Persisted `head_to_head_records` reads for `GET /api/league/head-to-head` in
  PostgreSQL repository mode.
- Explicit failure for absent persisted records, preventing fixture-result
  derivation in the release path.
- Deterministic, idempotent synthetic head-to-head seeding.
- Clean migrated PostgreSQL evidence for team identity, matchup scores, and
  stored-row count.

## Safety and scope

- No migration or schema change.
- No GCP, Terraform, deployment, secret, or public-access change.
- EPL fixture scoring context and complete league parity remain later #67 work.
