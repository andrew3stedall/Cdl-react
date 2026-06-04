# Player Detail, Gameweek History, and Comparison

## Purpose

Define player detail pages, FPL gameweek history, CDL ownership history, and player comparison mode.

## Status

Checkpoint 4 complete.

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

## Data Access Requirements

- Use cached `element-summary` data for history.
- Keep CDL history separate from FPL data.
- Include availability reasons and action eligibility.

## Acceptance Criteria

- Manager can view player gameweek history.
- Manager can compare two players on points, minutes, form, cost, fixtures, status, and CDL availability.
