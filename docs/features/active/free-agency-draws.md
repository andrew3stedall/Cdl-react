# Free Agency Draws

## Purpose

Define configured free agency draw windows, private preferences, automatic draw order, deterministic processing, temporary rights, and expiry.

## Status

Checkpoint 3 complete.

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

- The Market workspace exposes an addressable `/scouting/draws` view and lists the signed-in manager's season draws.
- Managers can add available players, reorder ranked preferences, and save only while the API reports `open_for_preferences`.
- The private preference list and post-processing outcome are shown only for the requesting manager; public awards can be viewed after processing.
- Failed draw, preference, and results reads offer retry without exposing another team's preference list.
- Manager-specific missed/won explanation.

The React client uses `GET /api/free-agency/draws` (bare draw array), `GET`/`PUT /api/free-agency/draws/{draw_id}/preferences` (private ranked preference array; PUT body `{ player_ids }`), and `GET /api/free-agency/draws/{draw_id}/results` for public awards plus the authenticated team's private outcome. The server scopes preference reads and writes to the authenticated manager's team.
- Temporary right action prompt.

## Data Access Requirements

- Enforce preference privacy.
- Store result reason codes.
- Create temporary rights in the same transaction as draw processing.

## Acceptance Criteria

- Draw processing is deterministic and auditable.
- Public results do not expose all failed preferences.
- Unused rights expire and return player to free agency.
