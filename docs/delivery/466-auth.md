# Milestone #466 — Authentication and onboarding lane

## Delivered

The authentication lane adds a staging-and-production API session boundary, production startup checks for PostgreSQL persistence and secure cookies, and disables temporary password login in production. Anonymous private API calls now fail before route execution; development memory previews remain available only under explicit `environment=development`.

Verified Google identities can enter through an invite or reauthenticate when their existing account is already a league member. Unassigned PostgreSQL users are denied manager API access, and manager-context resolution no longer falls back to the demo team. Invite login return paths survive a tab refresh; failed logout remains signed in and exposes a retry action. Invite preview/accept errors distinguish permanent invalid links from retryable service failures.

Passkey status returns registered credential metadata, registration supports multiple keys, and an owner-checked delete API revokes a key. Production checkpoint prototype APIs return 404. Commissioner-only pending-invite list/revoke endpoints are implemented under the existing team-specific invite policy. No expiration duration or reassignment policy was introduced.

The auth session contract reports whether engineering previews are enabled; production disables the capability. Production Google admission failures caused by database/pool outages return structured retryable 503 responses.

## Validation

- Frontend typecheck and lint passed.
- Full frontend suite passed: 191 tests across 41 files, including invite-return reload, failed-logout retry, and multi-passkey management.
- Python compileall passed.
- Ruff passed for changed Python files.
- Full backend suite passed: 411 tests, 18 skipped, 170 warnings (including existing Starlette/httpx and SQLite datetime deprecations).
- Ruff passed for all changed Python files.
- No migration was needed. No staging or production cloud action was performed.
- Security review follow-up: unknown `CDL_ENVIRONMENT` values now fail Settings validation, and invalid production Google credentials return a structured 401.
- Auth, invite lifecycle, staging-boundary and production Google database-outage regressions passed in the focused 41-test run. Session API capability mapping passes both enabled and disabled cases.

## Remaining integration and policy

- The commissioner pending-invite UI consumes `GET /api/league/management/invites` and `DELETE /api/league/management/invites/{invite_id}`; both endpoints require commissioner authorization. Invite expiry remains policy-optional and reassignment stays separate in #535.
- #535 remains parked until policy answers: which commissioner roles may release/reassign; whether approval is required; what confirmation and immutable reason must be recorded; whether prior-user sessions are revoked immediately; and how the previous manager's team, fixture, lineup, and ownership history is preserved. No reassignment route or control was added.
- Production deployment remains off; these changes establish code behavior and local test evidence only.
