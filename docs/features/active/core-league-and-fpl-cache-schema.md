# Feature: Core League and FPL Cache Schema

## Purpose

Implement issue #64 by adding the shared PostgreSQL schema foundation for league data and FPL reference cache data.

## Status

Active implementation feature for issue #64.

Parent coordinator: #75
Parent milestone: #77
Depends on: #63

## Scope

- Add an append-only migration after `0002_auth_preferences`.
- Add tables for leagues, seasons, draft teams, managers, memberships, and permissions.
- Add tables for EPL teams, FPL positions, FPL players, values, availability, and freshness metadata.
- Add repository metadata so follow-up repositories can share one table map.
- Keep squad rights, trades, dashboard production calculations, and FDR production calculations out of scope.

## Acceptance Criteria

- `0003_core_league_fpl_cache` creates the core league and FPL cache tables.
- Metadata tests cover the expected table set.
- Migration documentation shows the append-only dependency on #63.
- Documentation and changelog are updated.
- #78 remains blocked until Andrew confirms manual GCP bootstrap completion.
