# Product Overview

Castle Draft League is a draft-style fantasy football league application built around private leagues, live drafts, squad management, head-to-head fixtures, chips, live scoring, and knockout finals.

## Product goals

- Support reusable leagues across seasons.
- Let any account holder create a league and invite managers.
- Run live drafts in app.
- Support free agency draws, transfers, loans, and commissioner approvals.
- Provide weekly team selection with deadline locking.
- Calculate CDL fixtures from locked lineups and FPL data.
- Show live scoring, fixture details, table movement, and knockout brackets.
- Preserve historical results and audit trails.

## Manager experience source of truth

Feature ownership and manager-facing navigation are defined in [`docs/product/feature-placement-and-navigation.md`](../product/feature-placement-and-navigation.md).

Current page specifications are:

- [`Home`](../product/pages/home.md) — urgency, deadlines and actions that need attention.
- [`Squad`](../product/pages/squad.md) — season-long squad health and roster actions.
- [`Market`](../product/pages/market.md) — discovery, draws, watchlist, Interests and trades.
- [`Matchweek`](../product/pages/matchweek.md) — weekly lineup, bench, captaincy and chips.
- [`League`](../product/pages/league.md) — fixtures, table and competition context.

Unresolved UI questions and implementation dependencies are kept in [`docs/product/ui-refinement-continuation.md`](../product/ui-refinement-continuation.md) so settled product decisions do not need to be rediscovered in chat.

## Design direction

The rebuild should not be a like-for-like recreation of the legacy PHP application. It should use the legacy app as a behavioural reference while building clearer domain services, database models, APIs, and React workflows.

Feature ownership should be stable even when the detailed page layout changes. Quick, contextual work should remain in drawers or bottom sheets; consequential or multi-step work should move into the owning feature flow.

## Core workflows

```text
create league
→ invite managers
→ configure season
→ run draft
→ manage squads
→ select weekly lineups
→ score fixtures
→ update tables
→ run knockouts
→ preserve history
```
