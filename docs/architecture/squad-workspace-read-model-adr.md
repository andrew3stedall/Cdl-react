# ADR: Consolidated Squad workspace read model

Status: accepted

Date: 2026-08-14

## Context

The canonical `/squad` surface now combines season-long squad management with
weekly team selection. Its first render previously made six parallel requests.
Several of those requests rebuilt the same PostgreSQL squad repository and
reloaded the full player and fixture dataset, while scouting and squad-change
data was not needed until a drawer or panel was opened.

## Decision

Add `GET /api/squad/workspace` as the combined Squad-management read model. It
returns the squad summary and lightweight attention/notification data. Keep
`GET /api/team-selection` as a separate initial read because lineup, chips and
fixture locks remain an independent domain boundary.

Load scouting players and available squad-change rights on demand. Keep
lineup, chip, squad-change, interest and trade mutations on their existing
command endpoints.

The PostgreSQL squad repository may reuse its player snapshot within a single
request so the workspace summary and attention calculation do not repeat the
same full player query. This is request-scoped reuse, not a cross-user cache.

## Consequences

- Initial Squad load decreases from six requests to two.
- Session verification and repository construction happen fewer times during
  first paint.
- Large scouting and available-rights payloads are deferred until needed.
- Team-selection and squad-management contracts remain independently testable.
- The composite endpoint is a read model, not a replacement for domain write
  endpoints.

## Out of scope

- Changing authentication semantics or session storage.
- Changing database schema, Cloud SQL tier, or Cloud Run settings.
- Combining Market, Interest, or trade-management screens into the Squad
  workspace.
