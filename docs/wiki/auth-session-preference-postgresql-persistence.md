# Auth Session and Preference PostgreSQL Persistence

## Purpose

This page documents issue #63. It starts milestone #77 after the database foundation milestone #76.

Parent coordinator: #75
Parent milestone: #77
Depends on: #76

## Tables

The `0002_auth_preferences` migration adds:

- `users`
- `sessions`
- `user_preferences`

The #61 baseline migration remains append-only and unchanged.

## Repository modes

`CDL_REPOSITORY_MODE=memory` keeps the existing in-memory repositories.

`CDL_REPOSITORY_MODE=postgres` now builds PostgreSQL-backed repositories for users, sessions, and user preferences through the repository factory.

## Current seed behaviour

The PostgreSQL user repository seeds the demo manager user so the existing development login flow can keep working while production identity work remains out of scope.

## API compatibility

The following routes keep their response shapes:

- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `GET /api/me/preferences`
- `PUT /api/me/preferences`

## Handoff

#64 can add league and FPL cache schema without changing the auth/session/preference factory contract.

#78, #70, and #71 remain blocked until Andrew confirms manual GCP bootstrap completion.
