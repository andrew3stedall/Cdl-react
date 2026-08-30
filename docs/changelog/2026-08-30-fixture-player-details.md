# 2026-08-30 — Fixture player detail interactions

## Changed

- Loaded both fixture squads for upcoming, live, and completed fixture drawers.
- Made player cards, substitutes, and reserves selectable from the fixture
  drawer.
- Live and completed fixture players now open the shared FPL scoring breakdown
  with minutes, returns, and signed fantasy-point values.
- Upcoming fixture players now open the shared player profile sheet in read-only
  mode, without squad-management actions.

## Validation

- Added League page coverage for live points breakdown and read-only upcoming
  player profiles.
- `git diff --check`
- Frontend lint, tests, typecheck, and production build passed.
