# Milestone 466 auth acceptance follow-up

The PostgreSQL release journey now covers the two outstanding backend acceptance paths from
issues #468 and #469 in one isolated invited-manager lifecycle.

For #468, a verified invitee first obtains an authenticated session before accepting the invite.
The protected team-selection read and Triple Captain write both return 403 while that account has
no assigned team. After acceptance, the manager can read and update only the invited team's
lineup/chip state; the existing second-manager assertions confirm the commissioner's state is
unchanged.

For #469, the same account signs out after assignment, signs in again through verified Google
claims without reusing an invite token, and regains access to its assigned team. The test then
removes that manager assignment, signs out, and verifies a new Google sign-in is rejected with
401. The verifier is deterministic test code; the journey exercises identity/member policy and
PostgreSQL persistence, not Google's live token verifier or real provider accounts.

Run with the PostgreSQL service and migrations used by `backend-postgres.yml`:

```bash
uv run pytest -q tests/test_postgres_release_journeys.py
```

If `CDL_DATABASE_URL` is not PostgreSQL, pytest skips this integration test. SQLite constructor,
service, or mocked-verifier tests do not substitute for this release journey. No production
deployment or user data is changed by the test; it uses the explicitly enabled synthetic staging
fixture set and cleans up the invite, temporary manager, sessions, and team selection rows.
