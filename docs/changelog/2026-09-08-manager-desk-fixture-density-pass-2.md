# Manager Desk fixture density pass 2 — 2026-09-08

## User-facing change

- Reduced historical gameweek score squares again while keeping a larger treatment for the featured fixture.
- Pulled the paired historical scores closer to the gameweek label in the centre of each fixture.
- Increased team crest sizes for both featured and supporting fixtures.
- Removed the visible `Your fixture` label from the featured fixture while retaining its border, background, larger crest treatment, and first position.
- Raised league-position badges slightly within each fixture card.

## Scope

Presentation-only changes to the Manager Desk fixture board. Fixture ordering, manager nicknames, records, five-gameweek history, score colours, bonus markers, league positions, and current-gameweek visibility rules are unchanged.

## Validation

The change is CSS-only. Existing Manager Desk component tests continue to cover the fixture structure, nickname rendering, comparison result states, and bonus markers. CI and staging rollout status are recorded on the implementation pull request.
