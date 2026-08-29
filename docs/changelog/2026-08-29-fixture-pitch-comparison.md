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

## Validation

- Frontend typecheck passed.
- Frontend lint passed.
- Frontend tests: 143 passed.
- Frontend production build passed.
