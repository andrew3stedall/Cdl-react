# Remove synthetic staging fixtures

Use GitHub → `andrew3stedall/Cdl-react` → Actions → **GCP Run Staging Database Job** → **Run workflow**, branch **main**.

1. Select `operation=synthetic-fixture-cleanup`.
2. Set `confirm_database_jobs_applied=true` after the staging database-jobs Terraform stage is applied.
3. Set `confirm_synthetic_fixture_cleanup=true`.
4. Review the run summary. The job uses the pinned immutable staging image and reports fixture, result, and scoring-snapshot row counts.
5. Confirm completion before refreshing the app.

The cleanup is restricted in code to `CDL_ENVIRONMENT=staging`, PostgreSQL repository mode, an explicit PostgreSQL URL, and the `CDL_ALLOW_SYNTHETIC_FIXTURE_CLEANUP=true` job setting. Workflow dispatch also requires the explicit cleanup confirmation. The transaction selects only `cdl_fixtures` payloads whose `synthetic` field is the boolean `true`, then deletes fixture results and scoring snapshots that reference those fixture IDs. Rows without that marker, including Castle-imported fixtures, are retained. Repeating the operation is safe and reports zero rows after cleanup.

No browser cache invalidation is sent by the job. Reload the staging app after it completes.
