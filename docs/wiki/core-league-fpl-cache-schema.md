# Core League and FPL Cache Schema

## Purpose

This page documents issue #64. It extends the #63 PostgreSQL auth/session/preference foundation with shared league and FPL reference tables.

Parent coordinator: #75
Parent milestone: #77
Depends on: #63

## Migration

`0003_core_league_fpl_cache` follows `0002_auth_preferences`.

The migration adds tables for:

- leagues
- seasons
- managers
- draft teams
- league memberships
- league permissions
- FPL positions
- EPL teams
- FPL players
- FPL player values
- FPL player availability
- FPL cache freshness

## Repository metadata

`postgres_league_fpl.py` exposes `CORE_LEAGUE_TABLES` so follow-up repository implementations can share the same table definitions.

## Handoff

Follow-up repository work can add lookup, freshness, and missing-record behaviours against these tables.

Squad rights, trade persistence, dashboard production calculations, and FDR production calculations remain out of scope for this issue.

#78, #70, and #71 remain blocked until Andrew confirms manual GCP bootstrap completion.
