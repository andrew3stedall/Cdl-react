# Manager Desk ladder indicator positioning — 2026-09-10

## User-facing change

- Anchored fixture ladder-position indicators to the visible top of each fixture row.
- Removed the manager-column inset that was causing the indicators to sit too low.
- Reduced the indicator dimensions and typography again for featured and supporting fixtures.

## Scope

Presentation-only changes to the Manager Desk fixture board. Fixture ordering, manager nicknames, records, five-gameweek history, score colours, bonus markers, league positions, and current-gameweek visibility rules are unchanged.

## Validation

The existing Manager Desk component coverage continues to verify fixture structure, nickname rendering, comparison result states, and bonus markers. CI and staging rollout status are recorded on the implementation pull request.
