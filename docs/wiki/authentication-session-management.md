# Authentication and Session Management

## Purpose

Provide API-driven sign-in, session status, logout, and protected-route behaviour for the modern Castle Draft League application.

## Architecture

The backend exposes auth endpoints for login, session status, and logout.

The frontend exposes auth helpers for login, logout, session loading, and protected-route checks.

This implementation uses an in-memory development repository. It must be replaced with a production user and session store before real deployment.

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
