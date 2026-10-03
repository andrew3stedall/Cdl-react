# GCP Staging Database Migration and Seed Runbook

## Purpose

This runbook defines the controlled migration and deterministic synthetic seed jobs for staging. Reviewed manual apply and automatic rollout may execute the migration job as part of a runtime release; the seed job remains a separate explicit action.

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

## Runtime image release gate

For every runtime image rollout, the workflows first identify the one currently
serving revision at 100 percent and pin that revision in the Terraform plan.
Terraform can create the new image revision, but the old revision continues to
receive traffic. A runtime plan fails closed when it cannot identify that
healthy revision; first-time service creation must be handled as a separately
reviewed bootstrap sequence.

The order is:

1. Build or resolve the immutable application image digest.
2. Stage the image while the healthy revision retains traffic.
3. Verify the migration job uses the same image digest and execute it.
4. The migration entrypoint upgrades to Alembic `head`, reads PostgreSQL's
   current revision heads, and exits unsuccessfully if they differ from the
   checked-in migration heads.
5. Check staged revision readiness, `/health`, and the unauthenticated API
   boundary without routing public traffic to the candidate. Cloud Run v1 and
   v2 service shapes are both parsed; the candidate must be the latest created
   and latest ready revision, and its configured and resolved image digest must
   match the immutable image under review.
6. Promote that exact checked revision at 100 percent, not a moving `latest`
   target. A failed migration or staged check prevents
   this step. The direct fallback repeats the migration/image gate and stages
   with `--no-traffic` before it can promote.

The runtime smoke in these workflows is a health/auth-boundary check. Real
authenticated two-manager, invite, lineup and chip round trips run in the
PostgreSQL CI job; staging promotion does not mutate a manager's lineup to
manufacture a smoke result. These checks do not establish schema compatibility
for destructive migrations. Destructive or contract-breaking migrations need
an expand/contract rollout plan and separate approval before enabling the
automatic rollout path.

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

Cloud SQL does not permit its managed administrator to explicitly change the
PostgreSQL `SUPERUSER` attribute, even when requesting `NOSUPERUSER`. The
workflow therefore creates `cdl_app` with PostgreSQL's restricted defaults,
rotates only its login password, and fails before writing the secret unless a
catalog query proves every restricted attribute and `cloudsqlsuperuser`
membership remain false.

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

The workflow reads the image from the Cloud Run v1 job representation returned
by `gcloud run jobs describe` at
`spec.template.spec.template.spec.containers[0].image`. It then verifies that
the value is an immutable `@sha256` digest in the expected staging project's
`cdl-react-backend/cdl-react-app` repository before execution. An empty value,
a tag, or a digest from another project or repository fails closed. The
workflow does not create, update or replace the job definition.

Migration and seed execution must remain separate. A failed seed must not obscure whether schema migration succeeded.

The automatic runtime workflow uses the same immutable image digest for the
service and migration job. Migration failure retains the previously serving
revision. Before relying on the automatically started direct fallback, confirm
its migration execution and retained-traffic checks succeeded; it is not a
general recovery substitute for a failed migration.

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
- migration reads back the database revision and fails when it does not match
  the checked-in Alembic heads;
- seed execution refuses unsafe targets and requires confirmation;
- the bounded seed invokes existing idempotent domain seeders;
- the Terraform jobs use the dedicated identity, Cloud SQL and Secret Manager;
- the execution workflow is manual, main-only and confirmation-gated;
- CI applies all migrations to a clean PostgreSQL database and runs the
  two-manager release journey against that PostgreSQL service.

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
