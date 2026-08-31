# 2026-08-31 — Smooth gameweek carousel navigation

## Changed

- Made nested gameweek carousels bounded and non-looping.
- Centred the selected gameweek slide and added symmetric adjacent-week peeks
  where neighbouring gameweeks exist.
- Increased the Embla settle duration so swipe transitions feel continuous
  rather than snapping immediately between cards.
- Added horizontal hollow-or-filled gameweek navigation dots to each round's
  gameweek rail, matching the existing round navigation treatment.
- Mapped each gameweek slide directly to its Embla snap so the focused slide
  receives full scale and opacity during selection.
- Kept the active dot and focused card on the same in-round gameweek index,
  including when a partial fixture snapshot omits weeks.

## Validation

- Added League page coverage for the per-round gameweek navigation rail.
- Added interaction coverage for dot-to-slide selection alignment.
- Frontend League tests, typecheck, and production build passed.
