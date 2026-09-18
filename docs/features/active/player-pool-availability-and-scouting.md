# Player Pool, Availability, and Scouting

## Purpose

Define a unified player pool used across draft, free agency, trades, squad management, and team selection.

## Status

Checkpoint 4 complete.

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
- Market discovery uses the same compact player-card, points, and xG/xA list pattern as Squad, including row density, typography, and a side-aligned form gauge.
- Market discovery shows a compact owner label in the existing player-card fixture slot: the current manager's player uses the primary theme accent, a free agent uses the secondary accent, and another manager's player uses the tertiary accent. The label follows the selected FDR font/fill preference.
- Market discovery does not show player availability or status fields and does not offer filters for availability, status, or ownership.
- Watchlist and notes controls.

Availability remains domain data for workflow validation and dedicated player detail experiences. Ownership is retained as a compact high-scan Market cue rather than a separate list field.

## Data Access Requirements

- Do not duplicate CDL ownership into FPL cache tables.
- Availability service combines FPL facts with CDL squad/right/loan/transfer state.

## Acceptance Criteria

- Draft, free agency, trades, and team selection use consistent availability logic.
- Managers can see why a player is blocked.
- Watchlist and free agency preferences remain separate.
