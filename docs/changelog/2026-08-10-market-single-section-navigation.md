# Market single-section navigation

Date: 2026-08-10

## Decision

Market now uses one page-level section control with three mutually exclusive views:

1. **Discovery** — search and filter the player pool.
2. **Interests** — review draw-specific preference registrations.
3. **Trades** — review proposed trade activity.

The former hybrid Squad management content has been removed from Market. Squad and
team-selection content remains in the dedicated Squad workspace.

Fixture difficulty is no longer rendered as a Market context-navigation item. The
existing `/fdr` route remains directly addressable for compatibility, but it is not
part of the Market page workflow.
