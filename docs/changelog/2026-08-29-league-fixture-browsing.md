# League fixture browsing — 2026-08-29

## User-facing change

- Added a horizontal round carousel so only one competition round is rendered at
  a time. Regular-season gameweeks 1–35 are grouped into five rounds of seven;
  knockout stages remain separate carousel items.
- Kept the current/live gameweek as the largest and default fixture section.
- Added a compact in-round gameweek strip so upcoming and past gameweeks can be
  selected without stacking seven full fixture sections vertically.
- Added historical fixture squad detail from locked lineups and cached event
  points, including starters, substitutes, reserves, and captain markers.
- Preserved fixture row actions so live, completed, and upcoming fixture drawers
  continue to open from every view.

## Validation

- Added League component coverage for past-gameweek browsing and round switching.
- Frontend tests: 142 passed.
- Frontend lint and production build passed.
- League API/service tests: 7 passed, including historical lineup/points data.
