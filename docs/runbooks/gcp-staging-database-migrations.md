# GCP Staging Database Migration and Seed Runbook

## Purpose

This runbook defines the repository-side migration and deterministic synthetic seed entrypoints that future reviewed staging jobs will execute. It does not create or run a Cloud Run job, initialize credentials, connect to GCP, or change a database.

## Packaged migration command

The backend image contains:

- `alembic.ini`;
- the complete `migrations/` tree;
- the installed `cdl_api` package.

Run the controlled migration entrypoint with:

```bash
python -m cdl_api.migrate
```

The entrypoint upgrades to the current Alembic `head` revision.

## Deterministic synthetic seed command

Run seeding only as a separate command after a successful migration:

```bash
CDL_ENVIRONMENT=staging \
CDL_REPOSITORY_MODE=postgres \
CDL_ALLOW_SYNTHETIC_STAGING_SEED=true \
python -m cdl_api.seed_staging
```

`CDL_DATABASE_URL` must be resolved separately from the staging database secret. The seed command refuses production, memory mode, non-PostgreSQL URLs, and executions without the explicit synthetic-data confirmation flag.

The current bounded seed set invokes the existing idempotent identity, squad, and league seeders. It is explicitly synthetic and must not be represented as historical-export evidence. Dashboard/FDR and historical-import seed coverage remain tracked separately through #68 and #69.

## Required environment

`CDL_DATABASE_URL` is mandatory for both commands. The migration entrypoint deliberately refuses to use the local-development fallback URL in `migrations/env.py`.

A non-default Alembic configuration can be selected with:

```text
CDL_ALEMBIC_CONFIG=/path/to/alembic.ini
```

Do not place a database URL, password, signed URL, service-account key, or secret payload in the image, Terraform variables, workflow logs, or repository files.

## Intended staging execution boundary

Future reviewed Cloud Run jobs or equivalent controlled runners should:

1. use the immutable backend image digest already approved for deployment;
2. run migration and seed as separate jobs using the dedicated migration service account;
3. mount the planned Cloud SQL connection;
4. resolve `CDL_DATABASE_URL` from the existing `cdl-database-url` Secret Manager container;
5. execute `python -m cdl_api.migrate` first;
6. fail the deployment sequence if migration fails;
7. execute `python -m cdl_api.seed_staging` only with the explicit staging and synthetic-data guards;
8. record the image digest, starting revision, ending revision, execution identity, seeded domains and results.

Migration and seed execution must remain separate. A failed seed must not obscure whether the schema migration itself succeeded.

## Validation available before GCP

Repository validation proves that:

- the image includes the Alembic configuration and migration tree;
- migration refuses a missing database URL or Alembic configuration;
- migration requests an upgrade to `head`;
- seed execution refuses unsafe targets and requires explicit confirmation;
- the bounded seed command invokes each existing idempotent domain seeder once;
- CI still applies all migrations to a clean PostgreSQL database.

This does not prove Cloud SQL connectivity, Secret Manager resolution, IAM, migration duration, rollback, complete release-domain seeding, or live staging state.

## Live-action gate

Do not create or execute staging migration or seed jobs until:

- PR #104 or its successor is merged;
- the PostgreSQL release paths tracked by #77 are complete enough for staging;
- the GitHub `staging` environment and read-only Workload Identity verification succeed;
- the saved Terraform plan and cost/security impact are reviewed;
- the database credential has been created outside Terraform state through an approved process;
- the exact immutable image digest and commands are recorded.

Any live migration, seed, or chargeable infrastructure action requires the approval gates tracked by issues #70 and #78.
