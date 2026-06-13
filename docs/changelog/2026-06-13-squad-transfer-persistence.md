# 2026-06-13 - Add squad transfer persistence schema

## Added

- Added issue #65 PostgreSQL schema foundation for squad roster slots, ownership, player rights, draft picks, interests, free-agent claims, transfers, trades, approvals, rejection reasons, and audit events.
- Added append-only `0004_squad_transfer_persistence` migration after the #64 core league and FPL cache migration.
- Added PostgreSQL metadata for the squad persistence table set.
- Added wiki documentation for the #65 schema foundation and repository implementation handoff.

## Validation

- Added tests for the expected squad persistence table set, required columns, and migration dependency on `0003_core_league_fpl_cache`.
