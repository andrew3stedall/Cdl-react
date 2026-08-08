# Unified Squad workspace and global navigation

Date: 2026-08-09

## Decision

Squad Management and Team Selection are now one product workspace named **Squad**.

The canonical route is `/squad`. Legacy `/squad-management` and `/team-selection` paths remain supported as aliases so bookmarks, tests, and existing links continue to resolve to the same workspace.

## Global navigation

Top-level navigation is now globally configured as:

1. Home
2. Squad
3. Market
4. League

Matchweek is no longer a separate global destination. Mobile bottom navigation is rendered by a reusable `GlobalNavigation` component and consumes the same `primaryNavigationItems` configuration as the application shell. The old Squad-only hard-coded mobile menu is suppressed.

## Squad workspace

The Squad workspace keeps the existing season-long roster tools:

- pitch and list views
- squad metrics
- player details and profile drawers
- comparisons
- trade drafting
- staged releases and squad-change review

It now also embeds all existing team-selection functionality on the same page:

- starter / bench / reserve assignment
- lineup validation and persistence
- chip activation/deactivation
- fixture-lock handling
- CDL fixture and table context
- EPL fixture and table context

The team-selection implementation is exposed as a reusable `TeamSelectionPanel` rather than copied into Squad, keeping one API and validation implementation.

## Follow-up design direction

Pitch/list remain local Squad display controls. Global navigation must not change when the user changes Squad view. Future lineup UX improvements should enhance the embedded Squad experience rather than recreate a separate Matchweek page.
