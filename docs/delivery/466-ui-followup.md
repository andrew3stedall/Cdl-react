# Milestone 466 UI follow-up

## Purpose

Record two bounded UI fixes from the production retrospective: keep known player details available while FPL history loads (#518), and remove unused Squad/League page-header CSS after the shared `PageHero` migration (#486).

## Changes

- `PlayerProfilePage` now commits player identity, FPL history, and team-selection reads independently. A resolved player can render the profile and its close control while history is pending; history keeps its own loading/error state.
- Removed unused `.squad-page__hero` and `.league-page__hero` rules, their old brand/context header selectors, and mobile overrides. The shared shell continues to own page gutters and `PageHero` geometry.
- Updated the active player-detail and shell feature docs with the supported loading and layout behavior.

## Validation

- Added delayed-history and in-place identity-change regressions in `PlayerProfilePage.test.tsx`; they check the player identity and drawer control while history is pending and ensure the prior player/history are not shown for a new identity.
- `npm run typecheck` passed.
- `npm run lint` passed.
- Full frontend Vitest suite passed: 51 files, 234 tests.
- The parent run reports the strict browser layout suite passed 10 tests with 2 skipped; it includes responsive drawer and shared-header geometry checks. This branch did not run Playwright locally.

## Data and operational impact

No API, persistence, schema, authentication, or deployment behavior changed. The profile still renders its existing history loading/error states, and existing route geometry stays governed by the shared shell.

## Follow-up

The separate modal-lifecycle finding (#482) remains scoped to dialogs not yet using the shared lifecycle. Installed-PWA validation for #488 remains a separate environment-specific check.
