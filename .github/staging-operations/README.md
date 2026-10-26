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
