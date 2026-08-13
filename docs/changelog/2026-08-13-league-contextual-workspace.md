# 2026-08-13 — League contextual workspace

## Changed

- Removed the League contextual navigation strip and overview landing state.
- Added a Squad-style League header with Castle Draft League branding, a
  Fixtures/Table toggle, and notifications.
- Grouped current and upcoming fixture rows by gameweek in compact sections.
- Made fixture drawers state-aware: upcoming fixtures show squad comparison,
  active fixtures show live scoring, and completed fixtures show final result
  context.

## Validation

- Updated React League, shell, navigation, interaction, and documentation
  expectations.
- `git diff --check`
- Frontend npm validation deferred because the restricted environment could not
  create the npm cache or reach the npm registry.
