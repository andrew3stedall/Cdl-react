# 2026-08-30 — Fixture player detail interactions

## Changed

- Loaded both fixture squads for upcoming, live, and completed fixture drawers.
- Made player cards, substitutes, and reserves selectable from the fixture
  drawer.
- Live and completed fixture players now open the shared FPL scoring breakdown
  with minutes, returns, and signed fantasy-point values.
- Upcoming fixture players now open the shared player profile sheet in read-only
  mode, without squad-management actions.
- Reworked fixture rounds into a horizontal, looped Embla carousel where each
  slide owns the complete round layout and its nested vertical gameweek
  carousel.
- Preserved the relative gameweek position while changing rounds, removed
  round navigation arrows, and added Embla-style scale and opacity tweening.
- Removed the redundant round and gameweek chrome so the selected round uses
  the available body width directly.
- Constrained the vertical gameweek carousel to one fixed-height viewport,
  sized from the largest fixture list in the round, so gameweeks scroll within
  the carousel instead of extending the page.
- Increased the round tween range and side-slide exposure so neighbouring
  rounds visibly fade and scale into focus during horizontal scrolling.

## Validation

- Added League page coverage for live points breakdown and read-only upcoming
  player profiles.
- Added coverage for the round-as-slide layout, arrow-free navigation, and
  relative gameweek index persistence.
- Added coverage for the removed carousel headers and bounded gameweek
  viewport.
- `git diff --check`
- Frontend lint, tests, typecheck, and production build passed.
