# Player Pool, Availability, and Scouting

## Purpose

Define a unified player pool used across draft, free agency, trades, squad management, and team selection.

## Status

Checkpoint 4 implementation contracts are in progress on `checkpoint-4-competition-experience`.

## Business Rules

- Player availability is league-season aware.
- Blocked/unavailable players should be shown with reasons, not hidden.
- Injured players remain visible unless user filters them out.
- FPL data provides player facts; CDL data provides squad/control state.
- Watchlists are private scouting tools, separate from free agency preferences.
- Watchlists should notify on availability/status changes.
- Private player notes are supported.

## Target Architecture

```text
player_pool_view
player_availability_service
watchlists
watchlist_players
watchlist_notification_preferences
player_notes
squad_assignments
temporary_player_rights
loans
transfer_restrictions
fpl_players
```

Availability states include:

```text
available
in_your_squad
owned_by_other_team
temporarily_held_by_you
temporarily_held_by_other_team
loaned_to_you
loaned_out_from_you
cooling_off_blocked
pending_transfer
unavailable_fpl_status
```

## API Requirements

- Search/filter player pool.
- Return availability status and reason.
- Add/remove watchlist player.
- Add/update private note.
- Get workflow-specific actions for a player.

## React Requirements

- Reusable player table/cards.
- Position colour coding.
- Availability reason chips.
- Optional injured/status filters.
- Watchlist and notes controls.

## Data Access Requirements

- Do not duplicate CDL ownership into FPL cache tables.
- Availability service combines FPL facts with CDL squad/right/loan/transfer state.

## Acceptance Criteria

- Draft, free agency, trades, and team selection use consistent availability logic.
- Managers can see why a player is blocked.
- Watchlist and free agency preferences remain separate.
