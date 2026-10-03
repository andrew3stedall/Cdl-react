# Feature: Authentication and Session Management

## Purpose

Replace the legacy login and session checks with a modern, API-driven authentication flow for the Castle Draft League application. The 2026-10-03 retrospective auth fixes are implemented in the milestone #466 auth lane; production deployment remains gated.

## Status

Implemented staging authentication foundation with PostgreSQL-backed durable sessions, allowlisted
Google sign-in, and passkey support. The API boundary now protects staging and production, and
production rejects unsafe cookie/repository settings and temporary password sign-in. Existing
assigned league members can return through verified Google sign-in; invite return state survives a
login refresh. Apple sign-in remains disabled until credentials and the email allowlist are provisioned.

## Legacy Inventory

- `index.php` renders a Castle Draft login page with email and password fields.
- The form posts through legacy JavaScript using `assets/js/signin.js`.
- Authenticated pages include `checkSession.js` and expose `logout.php` links.

## Current Behaviour

Users can sign in with the staging email/password fallback, Google, or a registered device passkey.
Successful sign-ins receive a secure HTTP-only application cookie with a 30-day PostgreSQL-backed
session. The PWA reuses that same-origin cookie after the app is closed and reopened. Failed logout
keeps the signed-in session visible and offers a retry. Account security supports multiple passkeys,
listing and owner-checked revocation.

## Business Rules

- Staging supports allowlisted Google sign-in while retaining email/password as a temporary fallback.
- Production protects private API/schema routes, requires PostgreSQL persistence and secure session cookies, and disables temporary shared-secret login.
- Production Google sign-in accepts verified existing league members and valid invitees; unknown nonmembers are denied.
- Staging supports discoverable passkeys with required user verification, allowing Android
  fingerprint/face unlock or device PIN and iOS Face ID/Touch ID or device passcode.
- Apple sign-in is available only when all Apple credentials, redirect URI, and allowlisted emails
  are configured; it is never enabled by a partial configuration.
- Protected application screens must verify an active session.
- Sign out must invalidate the active session.

## Risks

- Existing password storage and session mechanics must be audited before migration.
- Legacy pages may rely on PHP session globals.
- Users may have multiple passkeys, and passkeys must be revocable per device in a later account
  management pass.

## Target Architecture

- React auth screens using shadcn/ui form, input, button, card, alert, and toast components.
- Python authentication service class for credential validation, session issuing, session refresh, and logout.
- WebAuthn server verification with one-time database-backed registration and authentication challenges.
- Provider credentials are exchanged for the CDL application session; Google or Apple tokens are
  not used as API session tokens.
- Pydantic models for login requests, auth responses, session state, and error responses.
- Repository classes for user lookup and session persistence.

## API Requirements

- `POST /api/auth/login`
- `GET /api/auth/google/config`
- `POST /api/auth/google`
- `GET /api/auth/apple/config`
- `GET /api/auth/apple/start`
- `GET /api/auth/apple/callback`
- `GET /api/auth/passkeys/config`
- `GET /api/auth/passkeys/authentication/options`
- `POST /api/auth/passkeys/authentication`
- `GET /api/auth/passkeys/registration/options`
- `POST /api/auth/passkeys/registration`
- `GET /api/auth/passkeys/status`
- `DELETE /api/auth/passkeys/{credential_id}`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`, if refresh tokens or sliding sessions are used.

## React Requirements

- Login page.
- Official Google Identity Services sign-in button when configured.
- Apple sign-in button when fully configured.
- Passkey registration from Account and passkey sign-in from Login.
- Protected route wrapper.
- Session provider hook.
- Sign-out action.
- Loading, invalid credentials, expired session, and network error states.

## UI Requirements

- Use shadcn/ui as the default component foundation.
- Provide configurable visual presets for login and protected layouts.
- Document default preset and user-selectable appearance behaviour.

## Data Access Requirements

- User repository for account lookup.
- Session repository for active session state.
- Passkey and one-time challenge repositories.
- No raw SQL in route handlers.

## Acceptance Criteria

- Users can sign in, maintain an authenticated session, and sign out.
- Protected routes redirect unauthenticated users to login.
- Invalid credentials produce safe, non-enumerating errors.
- Session state is available to React without direct PHP coupling.
- Sessions survive PWA/browser restarts until the 30-day server expiry or explicit logout.
- Passkey registration and authentication require user verification and consume each challenge once.

## Test Requirements

- Unit tests for authentication service behaviour.
- API integration tests for login, session, and logout.
- React tests for form validation and protected-route behaviour.
- Security tests for invalid credentials and expired sessions.
- Google token audience, verified-email, allowlist and same-origin request tests.
- Passkey option generation, challenge lifecycle, session expiry, and unsupported-device fallback tests.

## Documentation Requirements

- Wiki page documenting auth flow, API syntax, examples, and session lifecycle.

## Changelog Requirements

- Add an implementation changelog entry when this feature is built.
