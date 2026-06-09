# Backend Database Settings and Repository Factory

## Purpose

This page documents the issue #62 settings and repository factory foundation.

Parent coordinator: #75
Parent milestone: #76
Depends on: #61

This is backend composition work only. It does not add PostgreSQL-backed domain repositories and does not provision GCP resources.

## Environment variables

| Environment variable | Purpose |
| --- | --- |
| `CDL_REPOSITORY_MODE` | Selects the repository implementation mode. Defaults to `memory`. |
| `CDL_DATABASE_URL` | Server-side database URL for future PostgreSQL-backed repositories. |
| `CDL_DATABASE_POOL_SIZE` | Base pool size for future database engine construction. |
| `CDL_DATABASE_MAX_OVERFLOW` | Overflow connection allowance for future database engine construction. |
| `CDL_ENVIRONMENT` | Runtime environment name. |

## Repository modes

| Mode | Behaviour |
| --- | --- |
| `memory` | Uses existing in-memory repositories and preserves current API behaviour. |
| `postgres` | Reserved for follow-up PostgreSQL-backed repositories and fails clearly until they are implemented. |

## Factory boundary

Routes should depend on services. Services should depend on repositories. Repository construction should happen through the factory rather than inside route handlers.

Current implemented factory output:

```text
RepositoryBundle
  users -> InMemoryUserRepository
  sessions -> InMemorySessionRepository
```

Future issues should extend this factory instead of bypassing it.

## Handoff

#63 should add PostgreSQL-backed auth, session, and preference repositories behind the existing factory contract.

#78, #70, and #71 remain blocked until Andrew confirms manual GCP bootstrap completion.
