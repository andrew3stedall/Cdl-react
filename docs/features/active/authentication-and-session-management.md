# Feature: Authentication and Session Management

## Purpose

Replace the legacy login and session checks with a modern, API-driven authentication flow for the Castle Draft League application.

## Legacy Inventory

- `index.php` renders a Castle Draft login page with email and password fields.
- The form posts through legacy JavaScript using `assets/js/signin.js`.
- Authenticated pages include `checkSession.js` and expose `logout.php` links.

## Current Behaviour

Users sign in with email and password, access protected static pages after session validation, and sign out through a PHP logout endpoint.

## Business Rules

- Login requires an email address and password.
- Protected application screens must verify an active session.
- Sign out must invalidate the active session.

## Risks

- Existing password storage and session mechanics must be audited before migration.
- Legacy pages may rely on PHP session globals.
- Session expiry behaviour is not fully visible from sampled files.

## Target Architecture

- React auth screens using shadcn/ui form, input, button, card, alert, and toast components.
- Python authentication service class for credential validation, session issuing, session refresh, and logout.
- Pydantic models for login requests, auth responses, session state, and error responses.
- Repository classes for user lookup and session persistence.

## API Requirements

- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`, if refresh tokens or sliding sessions are used.

## React Requirements

- Login page.
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
- No raw SQL in route handlers.

## Acceptance Criteria

- Users can sign in, maintain an authenticated session, and sign out.
- Protected routes redirect unauthenticated users to login.
- Invalid credentials produce safe, non-enumerating errors.
- Session state is available to React without direct PHP coupling.

## Test Requirements

- Unit tests for authentication service behaviour.
- API integration tests for login, session, and logout.
- React tests for form validation and protected-route behaviour.
- Security tests for invalid credentials and expired sessions.

## Documentation Requirements

- Wiki page documenting auth flow, API syntax, examples, and session lifecycle.

## Changelog Requirements

- Add an implementation changelog entry when this feature is built.
