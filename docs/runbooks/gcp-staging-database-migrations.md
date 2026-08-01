# GCP Staging Database Migration and Seed Runbook

## Purpose

This runbook defines the controlled migration and deterministic synthetic seed jobs for the first staging environment. Terraform creates job definitions only; it never executes them automatically.

The relevant resources and workflow are:

- `infra/terraform/environments/staging/database_jobs.tf`
- `.github/workflows/gcp-bootstrap-staging-database-credential.yml`
- `.github/workflows/gcp-run-staging-database-job.yml`
- `src/cdl_api/migrate.py`
- `src/cdl_api/seed_staging.py`

## Packaged commands

The immutable backend image digest contains `alembic.ini`, the full migration tree, the React build and the installed `cdl_api` package.

Migration runs:

```bash
python -m cdl_api.migrate
```

Deterministic synthetic seed loading runs separately:

```bash
CDL_ENVIRONMENT=staging \
CDL_REPOSITORY_MODE=postgres \
CDL_ALLOW_SYNTHETIC_STAGING_SEED=true \
python -m cdl_api.seed_staging
```

`CDL_DATABASE_URL` is resolved from Secret Manager by each job. The seed command refuses production, memory mode, non-PostgreSQL URLs and executions without the explicit synthetic-data confirmation flag.

The current bounded seed invokes the idempotent identity, squad and league seeders. It is explicitly synthetic and is not historical-export evidence. Dashboard/FDR and historical-import coverage remain tracked through #68 and #69.

## Terraform deployment stages

Use **GCP Terraform Staging** with cumulative stages:

### `foundation`

```text
enable_database_jobs=false
enable_cloud_run=false
backend_image=""
```

This stage creates the database and supporting resources after explicit plan approval.

### `database-jobs`

```text
enable_database_jobs=true
enable_cloud_run=false
backend_image=<immutable @sha256 digest URI>
```

This creates two deletion-protected Cloud Run job definitions:

```text
cdl-react-staging-db-migrate
cdl-react-staging-synthetic-seed
```

Both use the dedicated migration service account, one task, no automatic retry, a bounded timeout, the Cloud SQL volume and the database URL secret. Creating or updating the jobs does not execute them.

### `runtime`

```text
enable_database_jobs=true
enable_cloud_run=true
backend_image=<same approved immutable digest URI>
```

The cumulative runtime stage retains both database jobs and adds the private web service. Do not plan runtime with database jobs disabled.

## Required environment and identity

Both jobs receive:

```text
CDL_ENVIRONMENT=staging
CDL_REPOSITORY_MODE=postgres
CDL_DATABASE_URL=<Secret Manager reference>
```

The seed job also receives:

```text
CDL_ALLOW_SYNTHETIC_STAGING_SEED=true
```

The migration identity can access only `cdl-database-url` and has `roles/cloudsql.client`. It does not receive the staging login secret. Database-level privileges are controlled by the database credential, not by GCP IAM alone.

Do not place a database URL, password, signed URL, service-account key or secret payload in the image, Terraform variables, workflow inputs, logs or repository files.

## Bootstrap or rotate the staging database credential

After the foundation is applied, manually run **GCP Bootstrap Staging Database
Credential** from `main`. Confirm the foundation gate and type:

```text
ROTATE STAGING DATABASE CREDENTIAL
```

The workflow authenticates with the existing keyless staging deploy identity and
refuses any project except `cdl-react-staging-ast`. It verifies the expected Cloud
SQL instance, `cdl_react` database and `cdl-database-url` secret container before
making a change.

The workflow generates both passwords inside its isolated runner. It briefly
rotates the default `postgres` password so it can connect through the Cloud SQL
Auth Proxy, creates or updates `cdl_app` through PostgreSQL, and then rotates the
administrator password to a new discarded value on every exit path. The
persistent `cdl_app` role:

- can log in and connect only where explicitly granted;
- can use and create objects in the `public` schema of `cdl_react`, as required
  by the current shared migration/runtime credential;
- cannot create databases or roles;
- is not a superuser, replication role, row-security bypass role, or member of
  `cloudsqlsuperuser`.

The workflow revokes the default public database and schema-creation grants,
writes the SQLAlchemy Unix-socket URL to a new `cdl-database-url` Secret Manager
version over standard input, and verifies only the version state. Passwords and
the database URL are masked and are not accepted as workflow inputs, uploaded as
artifacts, committed, or written into Terraform state.

This is a credential rotation: each successful run invalidates the previous
`cdl_app` password and creates a new secret version. Do not run it while staging
database jobs or the staging application are active. Older secret versions should
be disabled after the new version and database jobs are proven; do not destroy
them until rollback evidence has been reviewed.

The current shared credential necessarily has schema-creation permission so
Alembic can migrate. Splitting migration ownership from runtime DML is a future
hardening step and requires separate Secret Manager and Terraform wiring.

## Controlled execution

After the reviewed `database-jobs` plan is applied, manually run **GCP Run Staging Database Job** from `main`.

For migration:

1. select `migrate`;
2. confirm the database-jobs Terraform stage was applied;
3. leave synthetic-data confirmation false;
4. review the configured immutable image digest;
5. execute and wait for completion.

For synthetic seed loading:

1. first prove migration completed successfully;
2. select `synthetic-seed`;
3. confirm the database-jobs Terraform stage was applied;
4. explicitly confirm synthetic data is intended;
5. execute and wait for completion.

The workflow verifies that the Terraform-managed job uses an immutable `@sha256` image before execution. It does not create, update or replace the job definition.

Migration and seed execution must remain separate. A failed seed must not obscure whether schema migration succeeded.

## Evidence to record

For each execution record:

- source commit and image digest;
- job name and execution identity;
- starting and ending Alembic revision for migration;
- completion status and logs;
- seeded domains and explicit synthetic label;
- repeat-run result proving idempotency;
- any duration, connectivity or permission failure.

## Repository validation

Repository validation proves that:

- the image includes Alembic and seed entrypoints;
- migration refuses a missing database URL or configuration;
- migration requests an upgrade to `head`;
- seed execution refuses unsafe targets and requires confirmation;
- the bounded seed invokes existing idempotent domain seeders;
- the Terraform jobs use the dedicated identity, Cloud SQL and Secret Manager;
- the execution workflow is manual, main-only and confirmation-gated;
- CI applies all migrations to a clean PostgreSQL database.

This does not prove live Cloud SQL connectivity, secret resolution, database privileges, execution duration, rollback or staging state.

## Live-action gate

Do not apply or execute database jobs until:

- the GitHub `staging` environment values are configured;
- **GCP WIF Verify** succeeds on `main`;
- the foundation plan, cost and security impact are reviewed and approved;
- the foundation is applied through shared Terraform state;
- the database credential and secret version are created outside Terraform state;
- the immutable image digest is recorded;
- the `database-jobs` plan is separately reviewed and approved;
- PostgreSQL release paths are complete enough for the intended staging scenarios.

Any chargeable apply, migration or seed execution requires the approval gates tracked by issues #70 and #78.
