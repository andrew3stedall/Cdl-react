# Feature: Squad Transfer and Trade PostgreSQL Persistence

## Purpose

Implement issue #65 by adding PostgreSQL schema foundations for squad rights, interests, transfers, trades, approvals, and audit state.

## Status

Active implementation feature for issue #65.

Parent coordinator: #75
Parent milestone: #77
Depends on: #64

## Scope

- Add append-only migration after `0003_core_league_fpl_cache`.
- Add squad player rights, roster slots, draft picks, interests, free-agent claims, transfer proposals, trade proposals, trade assets, trade approvals, and squad audit tables.
- Add PostgreSQL metadata for follow-up repository implementations.
- Preserve current squad API response shapes while persistence work is staged.

## Out of Scope

- Team-selection lineup persistence.
- Fixture scoring persistence.
- Dashboard and FDR production calculations.
- Starting #78, #70, or #71.

## Acceptance Criteria

- `0004_squad_transfer_trade_state` creates the squad transfer/trade table set.
- Metadata tests cover the expected table set.
- Migration documentation shows the append-only dependency on #64.
- Documentation and changelog are updated.
- #78 remains blocked until Andrew confirms manual GCP bootstrap completion.
