# Team selection PostgreSQL persistence

Issue #66 persists team-selection state in PostgreSQL while retaining the seeded demo read model used by the current API surface.

## Scope

- `team_selection_lineup_slots` stores player slot, slot order, captaincy, vice-captaincy, gameweek, and draft-team ownership context.
- `team_selection_chips` stores chip status and the active or used gameweek marker for each draft team.
- `team_selection_fixture_locks` stores fixture lock records for gameweek, fixture type, lock scope, lock timestamp, and reason.
- `team_selection_audit_events` remains available for follow-up audit/event use.

Migration `0005_team_selection_persistence` follows `0004_squad_transfer_persistence`.

## Runtime wiring

`CDL_REPOSITORY_MODE=postgres` now builds `PostgreSQLTeamSelectionRepository` through `RepositoryBundle.team_selection`. The team-selection router resolves its service dependencies through the repository factory instead of a module-level in-memory repository, so lineup and chip mutations are written through the configured repository mode.

## Validation

Database-backed API tests cover valid lineup persistence, invalid lineup rejection without writes, chip persistence, invalid chip rejection without writes, and fixture summary behaviour staying available across the team-selection API.
