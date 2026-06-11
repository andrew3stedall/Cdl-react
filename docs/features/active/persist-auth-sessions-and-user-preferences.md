# Feature: Persist Auth Sessions and User Preferences in PostgreSQL

## Purpose

Implement issue #63 by adding PostgreSQL-backed persistence for authentication sessions and user preferences.

## Status

Active implementation feature for issue #63.

Parent coordinator: #75
Parent milestone: #77
Depends on: #76

## Scope

- Add PostgreSQL schema for users, sessions, and user preferences.
- Add PostgreSQL-backed repositories for users, sessions, and preferences.
- Wire `postgres` repository mode through the repository factory.
- Keep `memory` repository mode as the default.
- Keep auth and preference API response shapes unchanged.

## Out of Scope

- GCP provisioning.
- Starting #78, #70, or #71.
- League, squad, fixture, dashboard, FDR, or import persistence.

## Acceptance Criteria

- Auth, session, and preference tables are included in Alembic migrations.
- PostgreSQL-backed auth, session, and preference repositories exist.
- Repository factory can select PostgreSQL-backed repositories through settings.
- Default memory mode remains unchanged.
- Documentation and changelog are updated.
- #78 remains blocked until Andrew confirms manual GCP bootstrap completion.
