# GCP Staging Database Migration Runbook

## Purpose

This runbook defines the repository-side migration entrypoint that a future reviewed staging job will execute. It does not create or run a Cloud Run job, initialize credentials, connect to GCP, or change a database.

## Packaged migration command

The backend image now contains:

- `alembic.ini`;
- the complete `migrations/` tree;
- the installed `cdl_api` package.

Run the controlled entrypoint with:

```bash
python -m cdl_api.migrate
```

The entrypoint upgrades to the current Alembic `head` revision.

## Required environment

`CDL_DATABASE_URL` is mandatory. The entrypoint deliberately refuses to use the local-development fallback URL in `migrations/env.py`.

A non-default Alembic configuration can be selected with:

```text
CDL_ALEMBIC_CONFIG=/path/to/alembic.ini
```

Do not place a database URL, password, signed URL, service-account key, or secret payload in the image, Terraform variables, workflow logs, or repository files.

## Intended staging execution boundary

A later reviewed Cloud Run job or equivalent controlled runner should:

1. use the immutable backend image digest already approved for deployment;
2. run as the dedicated migration service account;
3. mount the planned Cloud SQL connection;
4. resolve `CDL_DATABASE_URL` from the existing `cdl-database-url` Secret Manager container;
5. execute `python -m cdl_api.migrate` once;
6. fail the deployment sequence if the migration command fails;
7. record the image digest, starting revision, ending revision, execution identity and result;
8. run deterministic synthetic seeding as a separate command and job.

Migration and seed execution must remain separate. A failed seed must not obscure whether the schema migration itself succeeded.

## Validation available before GCP

Repository validation proves that:

- the image includes the Alembic configuration and migration tree;
- the entrypoint refuses a missing database URL;
- the entrypoint refuses a missing Alembic configuration;
- the entrypoint requests an upgrade to `head`;
- CI still applies all migrations to a clean PostgreSQL database.

This does not prove Cloud SQL connectivity, Secret Manager resolution, IAM, migration duration, rollback, or live staging state.

## Live-action gate

Do not create or execute the staging migration job until:

- PR #104 or its successor is merged;
- the PostgreSQL release paths tracked by #77 are complete enough for staging;
- the GitHub `staging` environment and read-only Workload Identity verification succeed;
- the saved Terraform plan and cost/security impact are reviewed;
- the database credential has been created outside Terraform state through an approved process;
- the exact immutable image digest and migration command are recorded.

Any live migration or chargeable infrastructure action requires the approval gates tracked by issues #70 and #78.
