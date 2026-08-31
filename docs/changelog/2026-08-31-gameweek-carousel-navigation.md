# 2026-08-31 — Smooth gameweek carousel navigation

## Changed

- Made nested gameweek carousels bounded and non-looping.
- Centred the selected gameweek slide and added symmetric adjacent-week peeks
  where neighbouring gameweeks exist.
- Increased the Embla settle duration so swipe transitions feel continuous
  rather than snapping immediately between cards.
- Added horizontal hollow-or-filled gameweek navigation dots to each round's
  gameweek rail, matching the existing round navigation treatment.

## Validation

- Added League page coverage for the per-round gameweek navigation rail.
- Frontend League tests, typecheck, and production build passed.
