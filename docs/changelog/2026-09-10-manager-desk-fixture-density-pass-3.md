# Manager Desk fixture density pass 3 — 2026-09-10

## User-facing change

- Reduced the vertical padding around the Manager Desk fixture board and its matchup cards.
- Reduced the manager-column inset so crests, nicknames, records, and comparison rows fit more comfortably within each fixture.
- Reduced the size of ladder-position indicators for featured and supporting fixtures.

## Scope

Presentation-only changes to the Manager Desk fixture board. Fixture ordering, manager nicknames, records, five-gameweek history, score colours, bonus markers, league positions, and current-gameweek visibility rules are unchanged.

## Validation

The change is CSS-only. Existing Manager Desk component tests continue to cover the fixture structure, nickname rendering, comparison result states, and bonus markers. CI and staging rollout status are recorded on the implementation pull request.
