# Player Detail, Gameweek History, and Comparison

## Purpose

Define player detail pages, FPL gameweek history, CDL ownership history, and player comparison mode.

## Status

FPL player detail/history and the compact squad comparison are implemented. Completed fixture explanations use frozen scoring snapshots. A collapsed player-profile panel now reads dated team ownership periods from the persistent CDL ownership table, within the configured league. That read model does not identify why an ownership period started or ended, so it cannot distinguish draft, transfer, trade, draw, free-agent, or loan events. Event-level history and expanded comparison remain deferred under #533; engineering checkpoint 4 is not evidence of their persistent delivery.

## Supported and deferred history/comparison

| Capability | Current support | Boundary / deferred work |
|---|---|---|
| FPL player profile and gameweek history | Player profile shows FPL facts, form/minutes, fixture difficulty and opponent history from the current cached history API. | No CDL movement attribution is inferred from FPL data. |
| Compact player comparison | Squad can compare up to three players on points, form, xG and xA; it uses the existing comparison drawer and scouting read. | Expanded comparison with minutes, cost, fixtures, status and CDL availability is not delivered as one comparison view. |
| CDL ownership periods | Lazy profile disclosure reads persisted ownership rows and displays team, season, start/end date, and current status, with loading, empty, error and retry states. The endpoint is league-scoped and requires an assigned manager session. | Rows carry no movement/event type or source identifier. They cannot explain whether a period came from draft, transfer, trade, free-agency draw, other acquisition, or loan. |
| Movement timeline | None. | Requires an agreed canonical event projection across movement sources, identity/season context, and correction semantics. Until then, do not label periods as transfers or loans and do not invent event classifications. |

When a player record is not passed into the route, player detail now renders as soon as the player request resolves. FPL history and team-selection reads finish independently, so slow history does not hide a known player or drawer close control; history retains its own loading and unavailable states.

## Business Rules

- Player detail should support draft, free agency, trade, squad, and lineup decisions.
- Gameweek history stats are required.
- Player comparison should be available as a view/mode, not necessarily a separate product area.
- Player detail combines FPL facts with CDL availability and history.

## Target Architecture

```text
player_detail_view
player_comparison_view
fpl_element_summaries
fpl_players
fpl_fixtures
squad_assignments
transfers
loans
```

Suggested routes:

```text
/players/{fpl_player_id}
/players/compare?playerA=123&playerB=456
```

## API Requirements

- Get player detail.
- Get FPL gameweek history.
- Get CDL squad/transfer/loan history.
- Compare two players.
- Return workflow-specific actions.

## React Requirements

- Player profile page.
- Gameweek history table.
- Fixture run display.
- Availability/action panel.
- Player-vs-player comparison view.
- A collapsed CDL ownership-history disclosure lists recorded dated team ownership periods in the configured league, with current ownership and empty/error/retry states. It does not attribute movement types.
- Ownership history and private scouting reads are loaded only when their profile disclosures open.

## Data Access Requirements

- Use cached `element-summary` data for history.
- Keep CDL history separate from FPL data.
- Include availability reasons and action eligibility.

## Acceptance Criteria

- Manager can view player gameweek history.
- Manager can compare two players on points, minutes, form, cost, fixtures, status, and CDL availability.
- A known player identity and available drawer controls remain visible while FPL history loads; history failure has a separate state and does not block the profile.

The expanded comparison acceptance item remains the target; current delivered comparison is the compact Squad drawer described in the table above.

## Validation

- `frontend/src/PlayerProfilePage.test.tsx` delays history to verify the player identity and close control render first, and changes player identity in place to verify stale identity/history are not shown.
- Frontend typecheck, lint, and the full Vitest suite passed for the UI follow-up branch (51 files, 234 tests).
