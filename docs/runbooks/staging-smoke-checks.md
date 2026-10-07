# Staging Smoke Checks

Use this checklist after staging exists and a staging URL is available.

## Required checks

1. Open the staging base URL.
2. Confirm `/health` returns status `ok`.
3. Confirm `/api/contracts/theme-presets` returns at least one preset.
4. Confirm the frontend loads without a blank page.
5. Confirm login, squad, team selection, league, dashboard, and FDR routes can be opened with seeded staging data.
6. Confirm backend logs do not show repeated errors during the smoke pass.

Release automation keeps the currently serving revision at 100% while it runs
the checked-in Alembic migrations and verifies their recorded head. It tests
candidate `/health` and the unauthenticated API boundary before promotion.
The no-traffic candidate must also pass an authenticated reviewer smoke: the
workflow logs in with one existing seeded reviewer, reads the current 20-player
and five-chip team-selection contract, writes the exact same lineup back,
reloads it, verifies the manager/team and lineup are unchanged, and logs out.
The reviewer allowlist and staging login secret are read at runtime from Secret
Manager through narrowly scoped access granted to the deployment identity; they
are not written to artifacts. The authenticated two-manager invite/lineup/chip
journey remains a separate real-PostgreSQL CI gate. See
[the database migration runbook](gcp-staging-database-migrations.md) for the
exact ordering and failure behavior.

The current-contract Playwright smoke uses a deterministic 20-player/five-chip
fixture and checks mobile/desktop interactions and layout invariants. It does
not collect screenshots; screenshot capture remains manual through the
existing workflow.

## Authenticated deployed reviewer exercise

After the unauthenticated boundary checks, use an allowlisted staging reviewer session to verify one read/write/reload path:

1. Open the live staging URL and sign in through the configured staging identity.
2. Open **Squad** and confirm live players, formation, chips and deadline data load.
3. Open a starter, stage a captain change, close the profile, and select **Save lineup**.
4. Require the visible **Lineup saved and validated** result.
5. Reload **Squad** and verify the captain change persisted.
6. Restore the original captain, save, reload, and verify the original state is restored.
7. Record this as post-promotion deployed evidence; do not label it as candidate-before-promotion evidence.

## Result record

Record the date, staging URL, commit SHA, tester, failed checks, and follow-up issues.

## Gate

A failed smoke check blocks production go-live. Do not onboard real users from staging evidence until failures are fixed and rechecked.
