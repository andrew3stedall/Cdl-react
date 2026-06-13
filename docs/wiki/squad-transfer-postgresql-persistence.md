# Squad transfer PostgreSQL persistence

This page records the issue #65 implementation for replacing sample-backed squad, transfer, and trade state with PostgreSQL-backed persistence.

## Dependency position

- Parent coordinator: #75
- Parent milestone: #77
- Upstream dependency: #64, which introduced leagues, seasons, draft teams, managers, FPL players, positions, and cache metadata.
- Downstream dependency: #69, which needs stable import targets for historical squad and transfer records.

## Migration

`0004_squad_transfer_persistence` follows `0003_core_league_fpl_cache` and creates the squad domain tables that need the core league and FPL references.

## Runtime wiring

Squad management now resolves its repository through the shared repository factory. Memory mode keeps the existing in-memory repository for local/demo behaviour, while PostgreSQL mode builds `PostgreSQLSquadRepository` for squad interest and trade write paths.

The service layer delegates interest and trade persistence to the selected repository, preserving current API response shapes for `/api/squad/summary`, `/api/scouting/players`, `/api/interests`, and `/api/trades`.

## Table coverage

The schema foundation covers these groups:

- Roster structure: `squad_roster_slots`
- Ownership and rights: `squad_ownerships`, `player_rights`
- Draft assets: `draft_picks`
- Manager intent and free agency: `squad_interests`, `free_agent_claims`
- Transfers: `transfer_proposals`, `transfer_assets`
- Trades: `trade_proposals`, `trade_assets`, `trade_approvals`
- Validation and traceability: `squad_rejection_reasons`, `squad_audit_events`

## Validation

Tests cover:

- the expected squad persistence table set,
- migration dependency on `0003_core_league_fpl_cache`,
- repository factory construction for memory and PostgreSQL squad repositories,
- PostgreSQL-backed interest and trade API write paths, and
- validation failures for owned-player interests, invalid trade assets, unknown players, and missing trade updates.

## Handoff to #69

Historical import tooling should populate the core league/FPL tables from #64 and the squad persistence tables from #65 before enabling production data replacement work.
