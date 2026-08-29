# Fixture pitch comparison — 2026-08-29

## User-facing change

- Each fixture comparison Starting XI now has its own contained panel within
  the pitch, with matching row and player spacing for both teams.
- Bench display now keeps the goalkeeper in the first slot and preserves the
  four ordered outfield substitute slots.
- Removed the opponent Starting XI prediction section from fixture preview.

## Reusable components

- 'FixtureSquadComparison' is the comparison parent for pitch, substitutes,
  and reserves.
- 'FixturePitchView' and 'FixtureLineupPanel' are reusable pitch parents for
  other fixture and matchup surfaces.
- 'sortFixtureBench' centralises the goalkeeper-first bench presentation rule.
- Fixture pitch players compose the canonical `PlayerCard` inside the same
  positioned `squad-page__pitch-player` wrapper used by Squad, keeping the
  official shirt card contained within each lineup slot.
- Completed fixture gameweeks reuse the same pitch, substitute, and reserve
  structure, with the standard five-dot indicator driven by each player's
  gameweek points.
- Current gameweeks show that points indicator only after the player's
  selected-gameweek fixture kickoff, while future gameweeks retain form dots.

## Validation

- Frontend typecheck passed.
- Frontend lint passed.
- Frontend tests: 146 passed.
- Frontend production build passed.
