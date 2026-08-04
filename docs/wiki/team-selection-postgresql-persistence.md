# Team selection PostgreSQL persistence

Issue #66 persists team-selection state in PostgreSQL. Staging now reads the active 2026/27
Exeter Gently roster from `squad_ownerships` instead of retaining the seeded demo read model.

## Scope

- `team_selection_lineup_slots` stores player slot, slot order, captaincy, vice-captaincy, gameweek, and draft-team ownership context.
- `team_selection_chips` stores chip status and the active or used gameweek marker for each draft team.
- `team_selection_fixture_locks` stores fixture lock records for gameweek, fixture type, lock scope, lock timestamp, and reason.
- `team_selection_audit_events` remains available for follow-up audit/event use.

Migration `0005_team_selection_persistence` follows `0004_squad_transfer_persistence`.

## Runtime wiring

`CDL_REPOSITORY_MODE=postgres` now builds `PostgreSQLTeamSelectionRepository` through `RepositoryBundle.team_selection`. The team-selection router resolves its service dependencies through the repository factory instead of a module-level in-memory repository, so lineup and chip mutations are written through the configured repository mode.

The repository now reads the latest fixture lock for the active season/gameweek. The primary read response exposes that state, and both lineup and chip mutations stop with `409 conflict` before persistence when a lock exists.

For the staged 20-player squad, the initial editable allocation exposes eleven starters, four
bench players and five reserves. Persisted lineup rows override that initial ordering. The fixture
summary exposes the eight persisted CDL teams and cached EPL teams, and returns empty fixture lists
until current-season fixture rows exist.

The React team-selection client consumes the same read and mutation contract. A locked response renders a labelled view-only notice with the persisted reason and disables lineup, captain, vice-captain, chip, and save controls. Deterministic mobile and desktop Chromium journeys exercise this boundary, the `/api/team-selection/fixtures-summary` request/render contract, and save–reload restoration of lineup and chip state through a stateful API test double; PostgreSQL integration tests remain the database persistence proof.

## Validation

Database-backed API tests cover valid lineup persistence, invalid lineup rejection without writes, chip persistence, invalid chip rejection without writes, fixture-lock persistence, and fixture summary behaviour staying available across the team-selection API. Service-level API tests prove a lock is reported and blocks both mutation paths without changing chip state.
