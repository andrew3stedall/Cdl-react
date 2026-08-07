# 2026-08-07 — Feature placement and Squad workspace

## Product decisions captured

Converted the manager-experience refinement discussion into durable product specifications instead of defining pages independently.

Primary feature ownership is now:

- **Home** — urgency, deadlines and actions that need attention.
- **Squad** — season-long squad health and squad actions.
- **Market** — player discovery, draws, watchlist, Interests and trades.
- **Matchweek** — weekly lineup, bench, captaincy and chips.
- **League** — fixtures, table and competition context.

The detailed decisions are in `docs/product/feature-placement-and-navigation.md` and `docs/product/pages/`. Open questions are parked in `docs/product/ui-refinement-continuation.md`.

## Squad implementation

Added a dedicated `SquadPage` and routed `/squad-management` to it while leaving `/scouting` on the existing workspace as a temporary Market implementation.

The new Squad experience includes:

- season-long Squad framing rather than weekly lineup editing;
- Pitch/List views with remembered view preference;
- All Players and position-specific List tabs;
- configurable currently-supported analytical columns;
- quick player details with Compare, Release, Draft Trade and Full Profile actions;
- in-page comparison for up to three manually searched players in selection order;
- a collapsible Squad Changes panel;
- staged removals with Removed treatment and explicit Restore to Squad;
- a minimal Submit Squad Changes review dialog with blocking validation;
- a truthful empty Available to Add state until persistent draw-rights data is available;
- trade initiation guidance without fabricating projection/scarcity/demand scores that are not yet available;
- removal of staging/PostgreSQL implementation terminology from the new Squad user status.

## Navigation

Updated manager-facing navigation to **Home / Squad / Market / Matchweek / League**. Fixture Difficulty is temporarily contextual to Market while its longer-term feature placement is refined through implementation evidence.

## Deliberate backend boundary

This iteration does **not** connect the new Squad page to the in-memory modernisation/checkpoint squad-rights endpoints. The persistent manager API does not yet expose temporary draw rights or an atomic staged squad-change mutation.

Therefore:

- draw-won additions are not fabricated in staging;
- release remains a client-side staged change until the complete change set can be submitted through a persistent atomic API;
- the confirmation UI demonstrates validation and intended interaction without claiming the mutation has happened.

## Recommended next implementation

Build **Market** next. It is the owning feature for the Player Pool, draw Interests, watchlist and trade activity that currently remain in the legacy `/scouting` implementation. The Market slice should also establish the persistent draw-right handoff required to make Squad's Available to Add and atomic squad-change submission live.
