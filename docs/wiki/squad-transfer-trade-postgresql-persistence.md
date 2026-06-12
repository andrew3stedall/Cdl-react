# Squad Transfer and Trade PostgreSQL Persistence

## Purpose

This page documents issue #65. It extends the #64 core league and FPL cache schema with squad-management persistence tables.

Parent coordinator: #75
Parent milestone: #77
Depends on: #64

## Migration

`0004_squad_transfer_trade_state` follows `0003_core_league_fpl_cache`.

The migration adds tables for:

- squad player rights
- squad roster slots
- draft picks
- squad interests
- free-agent claims
- transfer proposals
- trade proposals
- trade assets
- trade approvals
- squad audit events

## Repository metadata

`postgres_squad_state.py` exposes `SQUAD_STATE_TABLES` so follow-up squad repository implementations can share the table definitions.

## Handoff

Follow-up work can replace in-memory squad interest and trade state with repository-backed behaviours while preserving the current API response shapes.

Team-selection lineup persistence and fixture scoring persistence remain out of scope for this issue.

#78, #70, and #71 remain blocked until Andrew confirms manual GCP bootstrap completion.
