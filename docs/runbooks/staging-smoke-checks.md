# Staging Smoke Checks

Use this checklist after staging exists and a staging URL is available.

## Required checks

1. Open the staging base URL.
2. Confirm `/health` returns status `ok`.
3. Confirm `/api/contracts/theme-presets` returns at least one preset.
4. Confirm the frontend loads without a blank page.
5. Confirm login, squad, team selection, league, dashboard, and FDR routes can be opened with seeded staging data.
6. Confirm backend logs do not show repeated errors during the smoke pass.

## Result record

Record the date, staging URL, commit SHA, tester, failed checks, and follow-up issues.

## Gate

A failed smoke check blocks production go-live. Do not onboard real users from staging evidence until failures are fixed and rechecked.
