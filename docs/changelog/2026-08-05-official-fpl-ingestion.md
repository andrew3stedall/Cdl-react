# 2026-08-05 — Official FPL bootstrap and fixture ingestion

## Summary

Added the first live Fantasy Premier League ingestion path. The backend now fetches the
official public `bootstrap-static` and `fixtures` resources, retains their raw payloads
and hashes, and normalizes current gameweeks, positions, EPL teams, players, player
value/availability, and fixtures into PostgreSQL.

## Runtime boundaries

- Refresh requires an authenticated manager-level role.
- Refresh is unavailable outside PostgreSQL repository mode.
- Invalid or unavailable upstream data fails explicitly and is written to the fetch
  audit without advancing freshness.
- No scheduled refresh or live gameweek scoring is included in this slice.
- Existing deterministic draft ownership data is not automatically remapped to current
  official FPL player IDs.

## Evidence

Focused tests cover HTTP endpoint binding and timeouts, upstream shape rejection,
idempotent normalized persistence, raw payload retention, fetch audit history, failure
freshness semantics, route contracts, role enforcement, and migration ownership.
