# Free Agency Draws

## Purpose

Define configured free agency draw windows, private preferences, automatic draw order, deterministic processing, temporary rights, and expiry.

## Status

Checkpoint 3 implementation contracts are in progress on `checkpoint-3-squad-movement`.

## Business Rules

- Free agency draws happen in configured gameweeks.
- Managers submit ranked preferences before draw close.
- Preferences are private before processing.
- Commissioner should not see preferences by default.
- Draw order is generated automatically per draw.
- Processing awards each team the first available preferred player in draw order.
- Draw wins create temporary rights, not immediate squad assignments unless squad space exists.
- Temporary rights expire at the FPL deadline if not activated.
- Failed preference detail remains private to the manager.

## Target Architecture

```text
free_agency_draws
free_agency_draw_order
free_agency_preferences
free_agency_results
temporary_player_rights
free_agency_events
```

Draw statuses:

```text
scheduled
open_for_preferences
locked
processing
processed
cancelled
corrected
```

## API Requirements

- List draws.
- Open/close draw preference window.
- Submit/reorder preferences.
- Generate draw order.
- Process draw.
- Show public results.
- Show private manager result detail.
- Expire unused rights at deadline.

## React Requirements

- Free agency preference entry UI.
- Private preference list.
- Public draw result view.
- Manager-specific missed/won explanation.
- Temporary right action prompt.

## Data Access Requirements

- Enforce preference privacy.
- Store result reason codes.
- Create temporary rights in the same transaction as draw processing.

## Acceptance Criteria

- Draw processing is deterministic and auditable.
- Public results do not expose all failed preferences.
- Unused rights expire and return player to free agency.
