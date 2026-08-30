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
- Reduced carousel/card spacing and tightened the fixed gameweek viewport so
  adjacent rounds and the active round's fixtures use the available space more
  effectively on mobile.
- Removed League page outer padding from the carousel surface, made all
  gameweeks use the same fixture-row sizing, and stacked each fixture's teams
  into separate sub-rows.
- Adjusted the bounded gameweek viewport for the taller stacked fixture rows.
- Kept every gameweek card at the same bounded height and normalized its
  heading line so status changes cannot change the card geometry.
- Extended the round carousel through the shell's horizontal inset and reduced
  its slide basis so adjacent rounds remain visibly inside the viewport without
  introducing horizontal page overflow.
- Simplified round headers to the round number with a teal active-round LED.
- Simplified gameweek headers to the gameweek number and deadline time while
  retaining the existing state colour treatment.
- Added a fixed lower peek for the next gameweek, with the same scale and
  opacity tween treatment as the round carousel.

## Validation

- Added League page coverage for live points breakdown and read-only upcoming
  player profiles.
- Added coverage for the round-as-slide layout, arrow-free navigation, and
  relative gameweek index persistence.
- Added coverage for the removed carousel headers and bounded gameweek
  viewport.
- Added coverage for the compact round and gameweek header content.
- Added coverage for the nested gameweek tween styles.
- `git diff --check`
- Frontend lint, tests, typecheck, and production build passed.
