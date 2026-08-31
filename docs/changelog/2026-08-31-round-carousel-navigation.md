# 2026-08-31 — Round carousel navigation

## Changed

- Widened the horizontal round slides while reducing the spacing between
  adjacent slides so neighbouring rounds remain partly visible.
- Added terminal insets so the first and last rounds centre correctly when
  selected instead of resting against the page edge.
- Disabled wrapping from the final round back to the first round.
- Added filled and hollow navigation dots below the carousel, with each dot
  selecting its corresponding round.

## Validation

- Added League page coverage for the round indicator count and active state.
- Added coverage confirming the active indicator follows round selection.
