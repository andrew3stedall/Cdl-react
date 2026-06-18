# 2026-06-13 - Team selection persistence

- Added PostgreSQL schema and metadata for issue #66.
- Added a schema test for the team-selection persistence table inventory.
- Added a PostgreSQL-backed team-selection repository for lineup slot, captaincy, vice-captaincy, bench/reserve order, chip state, and fixture-lock records.
- Routed the team-selection API through the repository factory so `CDL_REPOSITORY_MODE=postgres` uses the database-backed implementation.
- Added PostgreSQL-backed API tests for valid persistence, invalid lineup and chip updates, and fixture summary coverage.
