# ADR proposal: dynamic league and season context

## Status

Proposal for #522; not an accepted product or architecture decision.

## Context

The schema already has reusable `leagues`, `seasons`, `draft_teams`, memberships, and invitations. The application still resolves its active league and season through `LEAGUE_ID` and `SEASON_ID` constants. Those constants are consumed across authentication/team context, invitations, squad ownership, team selection, free agency, fixtures, settlement, standings, dashboard reads, and staging seed code. `draft_teams` has league identity but no season-specific team identity or display name. Creating leagues or seasons through commissioner endpoints today would create records that the manager APIs do not select, and would not support season-specific team names or assignments.

## Proposal

Before #522 exposes league/season creation or switching, introduce a request-scoped active league/season context and a `season_teams` identity. A `season_team` should bind one persistent team to one season, carry the season-specific display name/status, and be the manager-facing ownership boundary. Membership and invitation acceptance should select a league and season explicitly. Every manager-scoped repository should receive the resolved context rather than importing global IDs.

The migration should preserve the existing CDL 2026/27 rows by creating corresponding `season_teams` and backfilling current memberships/ownerships before switching reads. A compatibility adapter may select the existing season for legacy/demo routes during the transition, but new records must be reachable by the same context path before creation endpoints ship.

## Scope required before implementation

- Decide whether one user may hold multiple teams across seasons and how a returning manager claims a persistent team.
- Decide league and season creation ownership, lifecycle transitions, deletion/archive rules, and who may switch active context.
- Define migration mapping for current `draft_teams`, `league_memberships`, invites, squads, lineups, fixtures, and historical results.
- Convert manager-scoped reads and writes to context-aware repositories, with cross-league and cross-season isolation tests.
- Add commissioner APIs and UI only after context selection and `season_teams` are end-to-end usable.

## Consequences

This proposal intentionally does not add ineffective create-season records or claim multi-league support. #522 remains deferred until the product decisions and context/identity migration are accepted. Existing single-season flows continue on the current 2026/27 context.
