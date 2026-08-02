# GCP GitHub Actions Deployment Runbook

## Purpose

This runbook explains how GitHub Actions connects to the CDL React staging project and how the first single-service staging environment progresses from an unapplied Terraform design to a reviewable Cloud Run URL.

Use this with:

- `docs/runbooks/gcp-bootstrap-setup.md`
- `docs/runbooks/gcp-staging-saved-plan.md`
- `docs/runbooks/gcp-staging-database-migrations.md`
- `docs/runbooks/gcp-staging-observability.md`
- `docs/architecture/gcp-single-service-staging.md`
- `infra/terraform/environments/staging/`
- `.github/workflows/gcp-wif-verify.yml`
- `.github/workflows/gcp-terraform-staging.yml`
- `.github/workflows/gcp-deploy-staging.yml`

## Target staging shape

```text
GitHub Actions
  -> Workload Identity Federation
  -> Artifact Registry immutable application image
  -> Terraform-managed Cloud Run service
      -> React static application
      -> FastAPI /api and /health routes
      -> Cloud SQL PostgreSQL through /cloudsql
      -> Secret Manager runtime values
```

The frontend and API are built into one image and use the same Cloud Run origin. Browser clients continue to call relative `/api` routes, avoiding a separate CORS and cross-site cookie boundary for the first review environment.

When Cloud Run is enabled, the reviewed runtime configuration is:

```text
CDL_ENVIRONMENT=staging
CDL_REPOSITORY_MODE=postgres
CDL_SESSION_COOKIE_SECURE=true
CDL_DATABASE_URL=<Secret Manager reference>
CDL_DEVELOPMENT_LOGIN_SECRET=<Secret Manager reference>
CDL_GOOGLE_CLIENT_ID=<Secret Manager reference>
CDL_GOOGLE_ALLOWED_EMAILS=<Secret Manager reference>
```

Cloud Run and public invocation remain disabled by default. The explicit runtime
`application-login` access model enables normal browser invocation only after the global
staging API session boundary and exact Terraform IAM exception pass review.

## Required GitHub environment

Create a GitHub environment named:

```text
staging
```

Add these environment variables, not repository secrets:

```text
GCP_STAGING_PROJECT_ID
GCP_STAGING_PROJECT_NUMBER
GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER
GCP_STAGING_DEPLOY_SERVICE_ACCOUNT
GCP_TERRAFORM_STATE_BUCKET
```

Expected value shapes:

```text
GCP_STAGING_PROJECT_ID=cdl-react-staging-ast
GCP_STAGING_PROJECT_NUMBER=123456789012
GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER=projects/123456789012/locations/global/workloadIdentityPools/github-pool/providers/github-provider
GCP_STAGING_DEPLOY_SERVICE_ACCOUNT=github-deploy@cdl-react-staging-ast.iam.gserviceaccount.com
GCP_TERRAFORM_STATE_BUCKET=cdl-react-staging-ast-terraform-state
```

Obtain the exact bootstrap outputs without exposing credentials:

```bash
terraform -chdir=infra/terraform/bootstrap output -raw staging_project_number
terraform -chdir=infra/terraform/bootstrap output -raw staging_workload_identity_provider
terraform -chdir=infra/terraform/bootstrap output -raw staging_deploy_service_account
terraform -chdir=infra/terraform/bootstrap output -raw terraform_state_bucket
```

These values identify resources and are GitHub environment variables, not secret payloads.

## 1. Verify keyless authentication

After the five variables are configured, manually run **GCP WIF Verify** from the Actions tab using `main`.

The workflow is deliberately read-only. It:

1. refuses non-`main` refs;
2. exchanges GitHub OIDC for the staging deploy identity;
3. confirms the active account, project ID and project number;
4. confirms visibility of the required APIs;
5. confirms read visibility of the protected Terraform state bucket;
6. records that no GCP resource was changed.

A successful run is required before an authenticated Terraform plan or image push.

## 2. Validate and review the foundation plan

Pull requests run only repository-safe Terraform validation:

```text
terraform fmt -recursive -check
terraform init -backend=false
terraform validate
```

After WIF verification succeeds on `main`, manually run **GCP Terraform Staging**. The authenticated job initializes the committed GCS backend and creates reviewable plan evidence. It does not apply infrastructure.

Review the plan and assessment together. Reject unexpected resources, destructive actions, public IAM, remote-state drift, unexplained IAM, production references or an unacceptable cost estimate.

## 3. Apply the foundation only after approval

The first approved apply must use the shared backend and keep:

```text
enable_cloud_run=false
enable_google_sign_in=false
allow_public_invoker=false
```

That foundation apply creates the reviewed supporting resources, including Artifact Registry, Cloud SQL, Secret Manager containers, service accounts, IAM, monitoring and the optional private asset bucket. It does not yet create a usable application service.

No automatic apply workflow is provided. A chargeable apply requires Andrew's explicit approval after the exact plan and cost/security assessment are presented.

## 4. Initialize runtime credentials outside Terraform state

Terraform creates secret containers only. Create secret versions through a separately controlled operator process after Cloud SQL exists.

Required runtime values are:

- `cdl-database-url`: a SQLAlchemy PostgreSQL URL using the `/cloudsql/<connection-name>` Unix socket;
- `cdl-development-login-secret`: a staging-only review password until the real identity design replaces it.
- `cdl-google-client-id`: the Web OAuth client ID used by Google Identity Services;
- `cdl-google-allowed-emails`: a comma-separated exact email allowlist, initially
  `andrew3stedall@gmail.com`.

The Google browser credential flow does not use an OAuth client secret. Do not create or store
one for this integration. Configure the Web OAuth client with the exact authorized JavaScript
origin `https://cdl-react-staging-api-tkhbn7jfsa-ts.a.run.app` and use a supported full browser,
not an embedded Android webview.

For the first rollout, apply a reviewed runtime plan with `enable_google_sign_in=false` to
create the two Google secret containers and runtime access grants without attaching empty
secrets to Cloud Run. Add their first versions only after that apply succeeds. A second reviewed
runtime plan may set `enable_google_sign_in=true`.

Do not place either payload in GitHub variables, committed files, Terraform variables, plan evidence or Terraform state.

Use the manual, `main`-only **GCP Bootstrap Staging Database Credential**
workflow described in
`docs/runbooks/gcp-staging-database-migrations.md` to create or rotate the
database credential. It creates a restricted `cdl_app` PostgreSQL login, writes
the SQLAlchemy Unix-socket URL directly to a new `cdl-database-url` version and
rotates away the temporary administrator password. No password or URL is
accepted as a GitHub input, retained as an artifact, committed, or stored in
Terraform state.

Because migration and runtime currently share one database URL, `cdl_app` has
`CONNECT` plus `USAGE` and `CREATE` on the `public` schema of `cdl_react`. It has
no superuser, database-creation, role-creation, replication, row-security bypass,
or `cloudsqlsuperuser` membership. A future hardening change should split the
migration owner credential from a DML-only runtime credential.

## 5. Run controlled migrations and deterministic seed loading

The application image contains Alembic and supports:

```bash
python -m cdl_api.migrate
```

Run migrations through the dedicated migration identity, not through normal web-service startup. Migration and deterministic seed execution remain separate, repeatable jobs. Do not automatically migrate or seed every Cloud Run web revision.

Before runtime enablement, record evidence that:

- every Alembic migration reaches `head` on the staging database;
- the deterministic synthetic seed is idempotent;
- seed content is explicitly labelled synthetic;
- the seeded primary workflow can be read through PostgreSQL mode;
- no real historical export is represented as validated evidence.

## 6. Build the immutable single-service image

After the foundation exists, manually run **GCP Build Staging Image** from `main` and confirm that the reviewed foundation has been applied.

The workflow:

1. authenticates through Workload Identity Federation;
2. builds the React and FastAPI application into one image;
3. pushes a unique commit-SHA tag to Artifact Registry;
4. resolves the pushed image digest;
5. uploads a seven-day text artifact containing the source SHA and immutable digest URI;
6. does not create or update Cloud Run.

Use the resulting `image_digest_uri`, not the mutable tag, in the next Terraform plan.

## 7. Plan and apply Cloud Run runtime enablement

Generate a fresh authenticated Terraform plan with:

```text
enable_cloud_run=true
backend_image=<immutable image digest URI>
runtime_repository_mode=postgres
allow_public_invoker=false
```

Review that the plan:

- creates only the expected Cloud Run service and related non-public configuration;
- uses the runtime service account;
- mounts the expected Cloud SQL connection;
- resolves only the database URL and staging login secret;
- uses secure cookies;
- has zero minimum instances and a maximum of two;
- contains no `allUsers` or `allAuthenticatedUsers` principal;
- retains Cloud SQL deletion protection and recovery settings.

Apply only after a new explicit plan approval. Terraform, not the image workflow, owns the Cloud Run service and its configuration.

## 8. Apply the application-login access boundary

A private Cloud Run service has a stable HTTPS URL but is not usable as a normal phone-browser
application. Build an image containing the global staging session middleware, then generate a
runtime plan with `access_model=application-login`.

That reviewed model permits only:

- `allUsers` with `roles/run.invoker` on `cdl-react-staging-api`;
- anonymous access to the React login bootstrap and `/health`;
- session-authenticated access to every other `/api/*` route and the API schema routes.

Use approval phrase `APPLY STAGING runtime application-login`. The plan gate rejects every
other public member, role, address, action, and stage. This shared-password model is restricted
to synthetic staging data and does not replace production identity.

## 9. Prove staging

After the approved runtime apply, record:

- the Cloud Run URL and deployed image digest;
- frontend root and client-route loading;
- `/health` and database-aware readiness;
- successful authentication and logout;
- one persisted primary workflow;
- persistence across a new revision or restart;
- logs and alert visibility;
- backup and point-in-time recovery settings;
- rollback to the previous image digest;
- a documented restore drill.

## Minimum identity roles

Start narrow and expand only when evidence proves a role is needed. Expected staging boundaries include:

```text
roles/artifactregistry.writer for the image workflow
roles/run.admin for Terraform-managed Cloud Run only
roles/iam.serviceAccountUser on the runtime service account
roles/cloudsql.admin for Terraform-managed Cloud SQL
roles/secretmanager.admin for Terraform secret-container creation
roles/serviceusage.serviceUsageAdmin when Terraform manages project APIs
```

Runtime and migration identities receive `roles/cloudsql.client`; that permits connector access but not database-level privileges. The migration identity can read only `cdl-database-url`. The runtime identity can read only the database URL and staging login secret it consumes. Avoid Owner and Editor roles.

## Logging and alerting baseline

The unapplied design uses a zonal `db-f1-micro` PostgreSQL instance with 10 GiB SSD storage, automatic growth capped at 20 GiB, daily backups in `australia-southeast1`, seven days of transaction logs, eight retained automated backups and deletion protection.

The logging and alerting baseline includes sustained Cloud SQL CPU above 80% for five minutes, Cloud SQL `ERROR`-or-higher logs and Cloud Run error logs when the service exists. Notification channels reference pre-existing destinations and default to none. Terraform does not create recipient addresses or duplicate log sinks.

Provider validation proves schema compatibility only. After an approved apply, each policy still requires a controlled test event before alert delivery is considered proven. Backups, restoration, database connectivity and rollback also require live evidence.

## Current limitations

- No chargeable Terraform apply has been run for this application environment.
- Terraform does not create a database credential or Secret Manager payload; the
  separately gated credential workflow performs that live rotation.
- Controlled migration and deterministic seed job definitions exist, but live execution and proof remain pending.
- The staging application-login model is implemented; production identity remains undecided.
- Real historical exports remain a separate validation gate.
- Production is not configured.
