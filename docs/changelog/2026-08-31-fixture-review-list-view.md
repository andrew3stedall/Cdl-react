# 2026-08-31 - Add fixture review list view

## Added

- Added the same compact pitch/list view toggle used by Squad to League fixture squad review.
- Added a two-column list presentation that keeps both teams visible and groups each roster into Starting XI, Substitutes, and Reserves.
- Kept goalkeeper-first substitute ordering and position-grouped starter/reserve ordering.
- Kept gameweek-state metrics consistent with pitch view: past and started current fixtures show points, future fixtures show form, and current fixtures that have not kicked off remain unscored.
- Preserved existing player interactions so current/past rows open gameweek points detail and future rows open the read-only player profile.
- Persisted the fixture-review pitch/list preference locally.

## Validation

- Added React regression coverage for the default pitch state, view switching, two-team list rendering, metric state, player interaction, and list ordering.
