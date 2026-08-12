# ADR: Allowlisted Google sign-in for staging

## Status

Accepted for the synthetic-data staging environment.

## Context

The first public staging boundary used one shared password. That enabled phone-browser review,
but it provides no individual identity, is easy to forget, and is awkward to rotate. Cloud Run
IAM authentication does not provide a normal consumer browser sign-in flow on the service URL.

## Decision

Staging uses Google Identity Services for an optional primary sign-in path:

- the browser renders Google's official Sign in with Google button;
- the browser sends the returned ID-token credential to the same-origin FastAPI API;
- FastAPI verifies the Google signature, issuer, expiry and exact OAuth client audience with
  Google's maintained `google-auth` verifier;
- only verified email addresses in `CDL_GOOGLE_ALLOWED_EMAILS` may create a session;
- the staging allowlist is maintained as a protected Secret Manager value and is not committed;
- the verified Google subject and email create or reuse a manager in the existing `users` table;
- the existing PostgreSQL session repository issues the same secure, HTTP-only session cookie;
- a custom same-origin request header protects the credential endpoint from cross-site posts;
- the OAuth client ID and email allowlist are delivered through Secret Manager; and
- an explicit reviewed `enable_google_sign_in` Terraform switch attaches those secrets only
  after their first versions exist; and
- password login remains as a temporary fallback until live Google sign-in is proven.

The integration uses Google Identity Services authentication only. It does not request Google
API access or store Google access or refresh tokens. The OAuth client secret is not used by the
browser credential flow and must not be added to the repository or runtime.

## Consequences

- Google sign-in requires a Web OAuth client whose authorized JavaScript origin is the exact
  Cloud Run HTTPS origin.
- Google sign-in may not work inside embedded Android webviews; testers should use Chrome or
  another supported full browser.
- Adding another reviewer requires an explicit allowlist secret rotation.
- Rollout is two-phase: first create the secret containers with Google sign-in disabled, then
  populate them and approve a fresh runtime plan with Google sign-in enabled.
- The public Cloud Run IAM boundary remains unchanged: anonymous callers may render the login
  shell, while protected API and schema routes still require the application session.
- This staging identity design does not authorize production deployment or real user data.
