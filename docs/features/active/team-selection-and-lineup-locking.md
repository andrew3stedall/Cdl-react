# Team Selection and Lineup Locking

## Purpose

Define weekly team selection, lineup rollover, auto-adjustment, validation, captain/vice selection, chip activation point, and FPL deadline locking.

## Status

Checkpoint 2 complete.

## Business Rules

- Active squad, matchday team, and scoring lineup are separate concepts.
- Lineups roll forward automatically from previous gameweek.
- FPL deadline locks the lineup.
- After deadline, the team selection page should move to the next editable gameweek.
- Players leaving squad are auto-removed from future unlocked lineups.
- Auto-adjusted lineups submit as-is if manager does nothing.
- Invalid lineups should be prevented by UI and rejected by backend.
- Captain and vice captain must be starters.
- Bench players cannot be captain or vice captain.
- Reserves never score.
- Players should be colour-coded by position.

## Target Architecture

```text
lineup_submissions
lineup_players
lineup_status_history
chip_activations
lineup_readiness_view
```

Lineup statuses:

```text
rolled_forward
updated
confirmed
auto_adjusted
locked
commissioner_corrected
```

## API Requirements

- Get editable lineup for next gameweek.
- Roll forward lineup.
- Update lineup slots.
- Confirm lineup.
- Activate/cancel chip before deadline.
- Auto-remove unowned players from unlocked lineups.
- Lock lineups at FPL deadline.
- Get lineup readiness for managers/commissioner.

## React Requirements

- Starting XI, bench, and reserves sections.
- Empty/invalid slot guidance.
- Position colour coding.
- FPL deadline and countdown.
- Warning for rolled-forward or auto-adjusted lineup.
- View-only locked lineup link.

## Data Access Requirements

- Enforce position min/max and formation rules server-side.
- Enforce no edits after deadline.
- Preserve locked historical lineups.

## Acceptance Criteria

- Deadline-passed gameweek cannot be accidentally edited.
- Auto-adjusted lineup warns but still submits as-is.
- Captain/vice cannot be bench players.