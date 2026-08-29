# League fixture browsing — 2026-08-29

## User-facing change

- Added a round selector so only one competition round is rendered at a time.
- Kept the current/live gameweek as the largest and first fixture section.
- Reduced upcoming gameweeks to a compact next-fixture section and schedule rail.
- Added a collapsed Past results browser that can open any completed gameweek.
- Preserved fixture row actions so live, completed, and upcoming fixture drawers
  continue to open from every view.

## Validation

- Added League component coverage for past-gameweek browsing and round switching.
- Frontend tests: 141 passed.
- Frontend lint and production build passed.
- League API/service tests: 7 passed.
