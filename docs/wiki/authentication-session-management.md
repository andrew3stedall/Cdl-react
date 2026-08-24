# Authentication and Session Management

## Purpose

Provide API-driven sign-in, session status, logout, and protected-route behaviour for the modern Castle Draft League application.

## Architecture

The backend exposes auth endpoints for login, session status, and logout.

The frontend exposes auth helpers for login, logout, session loading, and protected-route checks.

Development can use in-memory repositories. Staging selects PostgreSQL-backed users, sessions,
passkeys, and one-time authentication challenges. Google credentials are verified server-side and
exchanged for the secure application session cookie. Apple is supported through the same exchange
pattern when its complete configuration is present.

Sessions are persistent for 30 days and expose `expires_at` to the frontend. The cookie remains
HTTP-only, secure in staging, same-site, and is never replaced with a token in `localStorage`.
Passkeys use WebAuthn resident credentials with required user verification; the server stores the
credential public key and counter, never biometric data.

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

Apple configuration and browser redirect endpoints:

```http
GET /api/auth/apple/config
GET /api/auth/apple/start
GET /api/auth/apple/callback
```

Passkey endpoints:

```http
GET /api/auth/passkeys/config
GET /api/auth/passkeys/authentication/options
POST /api/auth/passkeys/authentication
GET /api/auth/passkeys/registration/options
POST /api/auth/passkeys/registration
GET /api/auth/passkeys/status
```

The Google credential request must be same-origin, include `X-CDL-Google-Sign-In: 1`, match the
configured OAuth client audience, contain a Google-verified email, and pass the staging email
allowlist. No Google access or refresh token is stored.

Apple requires `CDL_APPLE_CLIENT_ID`, `CDL_APPLE_TEAM_ID`, `CDL_APPLE_KEY_ID`,
`CDL_APPLE_PRIVATE_KEY`, `CDL_APPLE_REDIRECT_URI`, and a non-empty
`CDL_APPLE_ALLOWED_EMAILS` allowlist. The provider is disabled if any value is missing.

Passkeys require `CDL_PASSKEY_RP_ID` and `CDL_PASSKEY_EXPECTED_ORIGIN`. Staging currently uses:

```text
CDL_PASSKEY_RP_ID=cdl-react-staging-api-tkhbn7jfsa-ts.a.run.app
CDL_PASSKEY_EXPECTED_ORIGIN=https://cdl-react-staging-api-tkhbn7jfsa-ts.a.run.app
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
