# Squad transfer PostgreSQL persistence

This page records the issue #65 schema foundation for replacing sample-backed squad, transfer, and trade state with PostgreSQL-backed persistence.

## Dependency position

- Parent coordinator: #75
- Parent milestone: #77
- Upstream dependency: #64, which introduced leagues, seasons, draft teams, managers, FPL players, positions, and cache metadata.
- Downstream dependency: #69, which needs stable import targets for historical squad and transfer records.

## Migration

`0004_squad_transfer_persistence` follows `0003_core_league_fpl_cache` and creates the squad domain tables that need the core league and FPL references.

## Table coverage

The schema foundation covers these groups:

- Roster structure: `squad_roster_slots`
- Ownership and rights: `squad_ownerships`, `player_rights`
- Draft assets: `draft_picks`
- Manager intent and free agency: `squad_interests`, `free_agent_claims`
- Transfers: `transfer_proposals`, `transfer_assets`
- Trades: `trade_proposals`, `trade_assets`, `trade_approvals`
- Validation and traceability: `squad_rejection_reasons`, `squad_audit_events`

## Repository metadata

`cdl_api.repositories.postgres_squad` exposes `SQUAD_PERSISTENCE_TABLES` so tests and future repository implementations can share the same table inventory.

The first pass deliberately stops at schema and metadata. The next #65 pass should add PostgreSQL repositories that preserve the current `/api/squad/summary`, `/api/scouting/players`, `/api/interests`, and `/api/trades` response shapes while replacing in-memory state.

## Validation

`tests/test_squad_persistence_schema.py` checks:

- the expected table inventory,
- key columns required by the issue #65 acceptance criteria,
- the migration dependency on `0003_core_league_fpl_cache`, and
- creation coverage for every table.

