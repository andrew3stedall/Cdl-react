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
candidate `/health` and the unauthenticated API boundary before promotion. The
authenticated two-manager invite/lineup/chip journey runs against PostgreSQL in
CI; it does not mutate a staging manager's team as part of the deployment
smoke. See [the database migration runbook](gcp-staging-database-migrations.md)
for the exact ordering and failure behavior.

The current-contract Playwright smoke uses a deterministic 20-player/five-chip
fixture and checks mobile/desktop interactions and layout invariants. It does
not collect screenshots; screenshot capture remains manual through the
existing workflow.

## Result record

Record the date, staging URL, commit SHA, tester, failed checks, and follow-up issues.

## Gate

A failed smoke check blocks production go-live. Do not onboard real users from staging evidence until failures are fixed and rechecked.
