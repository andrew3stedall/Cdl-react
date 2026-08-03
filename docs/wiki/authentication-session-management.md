# Authentication and Session Management

## Purpose

Provide API-driven sign-in, session status, logout, and protected-route behaviour for the modern Castle Draft League application.

## Architecture

The backend exposes auth endpoints for login, session status, and logout.

The frontend exposes auth helpers for login, logout, session loading, and protected-route checks.

Development can use in-memory repositories. Staging selects PostgreSQL-backed users and
sessions, and supports an allowlisted Google Identity Services credential flow. Google tokens
are verified server-side and are exchanged for the existing secure application session cookie.

## Syntax

Login endpoint:

```http
POST /api/auth/login
```

Session endpoint:

```http
GET /api/auth/session
```

Logout endpoint:

```http
POST /api/auth/logout
```

Google configuration and credential endpoints:

```http
GET /api/auth/google/config
POST /api/auth/google
```

The Google credential request must be same-origin, include `X-CDL-Google-Sign-In: 1`, match the
configured OAuth client audience, contain a Google-verified email, and pass the staging email
allowlist. No Google access or refresh token is stored.

## Examples

Frontend protected-route check:

```ts
const redirect = getProtectedRouteRedirect(session);
```

## Testing

Required validation:

```bash
uv run ruff check .
uv run ruff format --check .
uv run pytest
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

## Changelog

See `CHANGELOG.md`.
