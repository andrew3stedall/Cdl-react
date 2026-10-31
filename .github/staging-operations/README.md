# Staging database operation requests

Create one new JSON file in `.github/staging-operations/requests/` to start a staging database operation. Commit the request directly to `main` through the GitHub plugin. The workflow runs automatically; no Actions page or manual workflow dispatch is needed.

Use a unique filename for every request. A push must change exactly one request JSON file. Requests are retained as an audit trail. Do not put credentials or other secrets in request files.

Supported operations:

- `migrate`
- `synthetic-seed`
- `fpl-refresh`
- `synthetic-fixture-cleanup`

Every request must include `confirm_database_jobs_applied: true`, indicating that the Terraform-managed jobs have already been deployed. Synthetic seeding also requires `confirm_synthetic_data: true`. Synthetic fixture cleanup requires `confirm_synthetic_fixture_cleanup: true`.

Example cleanup request:

```json
{
  "operation": "synthetic-fixture-cleanup",
  "confirm_database_jobs_applied": true,
  "confirm_synthetic_fixture_cleanup": true
}
```

After committing, follow the resulting Actions run until it completes, inspect the job logs, then verify the staging API or database state. If it fails, diagnose the failure, repair the workflow or staging configuration as needed, and submit a fresh request file after the fix.

## Castle sync plan and apply

Create one new JSON file in `.github/staging-operations/castle-sync-requests/`
to run the Castle sync through GitHub Actions without opening the Actions page.
A plan request is read-only. Review its report and `plan_digest` before creating
a separate apply request. Apply requires the exact digest from the reviewed plan,
`confirmation: "IMPORT CASTLE STAGING"`, and the same projection and mapping
inputs. A stale plan is rejected without partial writes.

Example native plan request:

```json
{
  "operation": "plan",
  "projection": "native",
  "source_league": "",
  "team_aliases": {},
  "player_ids": {},
  "trade_gameweeks": {},
  "adopt_existing": false,
  "allow_gaps": true,
  "expected_plan": "",
  "confirmation": ""
}
```

For apply, copy the reviewed inputs unchanged, set `operation` to `apply`,
copy `plan_digest` into `expected_plan`, and set the confirmation phrase.
Each request must be a new JSON file so the plan and apply remain separate audit
events. The workflow still fetches a fresh Castle snapshot and only writes to the
configured staging database.

For a fixture-only backfill, set `native_entities` to
`["cdl_fixtures", "fixture_results"]` and `restore_missing` to `true`.
This reuses each fixture's saved Castle mapping and recreates selected rows that
are absent from staging. Other native entities remain untouched. Keep these
inputs identical in the matching apply request.
