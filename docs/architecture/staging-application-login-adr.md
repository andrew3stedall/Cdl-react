# ADR: Public staging invocation behind an application login

## Status

Accepted for the synthetic-data staging environment only.

## Context

The first Cloud Run runtime is private, which prevents a normal mobile browser from opening
the review URL. Granting `allUsers` the Cloud Run Invoker role removes only Google's
infrastructure-level authentication. The API previously protected some routes individually,
so enabling that IAM binding alone would have exposed other sensitive staging routes.

## Decision

Staging may use the explicit `application-login` access model. Under that model:

- Cloud Run grants only `roles/run.invoker` to `allUsers` on the one staging API service;
- FastAPI middleware requires a valid `cdl_session` for every `/api/*` route except login,
  logout, and session bootstrap;
- `/docs`, `/redoc`, and `/openapi.json` require the same session;
- `/health` and the React application remain reachable so the browser can render login;
- session cookies are HTTP-only, secure, and same-site; and
- the staging password comparison uses a constant-time digest comparison; and
- the application refuses to start in staging if the known development password is still set.

Terraform keeps `private` as the default. `application-login` is valid only for the cumulative
`runtime` stage. The reviewed plan manifest binds the resolved public-invoker boolean, and the
plan safety gate permits only the exact Terraform address, `allUsers` member, and
`roles/run.invoker` role. All other public IAM remains blocked.

## Consequences

- A normal phone browser can open the Cloud Run URL and authenticate with the staging account.
- Anonymous callers can reach the process and `/health`, but cannot reach application APIs or
  API schema routes.
- The staging login is a shared-password review control, not production-grade identity. It has
  no distributed rate limiter or individual-account audit trail.
- Only synthetic staging data is permitted behind this boundary. Production and real user data
  require a separately designed identity and authorization model.
- Enabling or removing public invocation still requires a reviewed runtime plan and explicit
  apply approval.
