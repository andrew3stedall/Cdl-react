# Feature: Backend Database Settings and Repository Factory

## Purpose

Implement issue #62 by adding database-aware backend settings and repository construction without replacing all existing in-memory repositories at once.

This follows #60 and #61 in milestone #76.

## Status

Active implementation feature for issue #62.

Parent coordinator: #75
Parent milestone: #76
Depends on: #61

## Scope

- Add typed settings for repository mode, database URL, environment name, and database pooling controls.
- Add a repository factory that selects repository implementations from settings.
- Keep current API contracts unchanged.
- Keep default behaviour in memory mode.
- Add tests that prove settings can select memory mode and reject unsupported PostgreSQL mode until follow-up repositories exist.

## Out of Scope

- Persisting auth/session data.
- Replacing domain repositories.
- Creating PostgreSQL-backed repositories for auth, league, squad, team selection, fixtures, dashboard, FDR, or imports.
- Provisioning GCP resources.
- Starting #78, #70, or #71.

## Settings

The backend now exposes these settings through `CDL_` environment variables:

| Setting | Purpose | Default |
| --- | --- | --- |
| `CDL_REPOSITORY_MODE` | Selects repository implementation mode. | `memory` |
| `CDL_DATABASE_URL` | Server-side database connection URL. | blank |
| `CDL_DATABASE_POOL_SIZE` | Base database pool size for future PostgreSQL engine construction. | `5` |
| `CDL_DATABASE_MAX_OVERFLOW` | Extra connection allowance for future PostgreSQL engine construction. | `5` |
| `CDL_ENVIRONMENT` | Names the runtime environment. | `development` |

## Repository Factory

The repository factory is the backend composition point for repository construction. It currently returns the existing in-memory repositories for `memory` mode.

`postgres` mode intentionally raises until follow-up issues add concrete PostgreSQL-backed repositories. This lets later work wire database repositories behind a stable factory contract without changing route handlers.

## API Compatibility

The auth router now receives repositories through the factory. The login, session, and logout API contracts remain unchanged.

## Handoff to #63

#63 should add PostgreSQL-backed auth/session/preference repositories and extend this factory rather than adding raw SQL to route handlers.

## Acceptance Criteria

- Typed settings include database URL, environment name, pooling controls, and repository mode.
- Backend dependency injection can select in-memory or PostgreSQL-backed repository mode safely.
- Unsupported PostgreSQL mode fails clearly until concrete repositories are implemented.
- Tests can override repository mode safely.
- Current API contracts remain unchanged.
- Documentation and changelog are updated.
- #78 remains blocked until Andrew confirms GCP bootstrap completion.
