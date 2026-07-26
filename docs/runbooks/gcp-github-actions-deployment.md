# GCP GitHub Actions Deployment Runbook

## Purpose

This runbook explains how to connect GitHub Actions to the CDL React staging GCP project after the manual bootstrap checklist is complete.

Use this with:

- `docs/runbooks/gcp-bootstrap-setup.md`
- `docs/runbooks/gcp-staging-observability.md`
- `infra/terraform/environments/staging/`
- `.github/workflows/gcp-wif-verify.yml`
- `.github/workflows/gcp-terraform-staging.yml`
- `.github/workflows/gcp-deploy-staging.yml`

## Current deployment shape

```text
GitHub Actions
  -> Workload Identity Federation
  -> Artifact Registry Docker repository
  -> Cloud Run staging API
  -> Cloud SQL PostgreSQL staging database shell
  -> Secret Manager runtime secret containers
```

The app currently deploys with:

```text
CDL_ENVIRONMENT=staging
CDL_REPOSITORY_MODE=memory
```

Do not switch staging to `CDL_REPOSITORY_MODE=postgres` until the repository factory, migrations, and database secrets are confirmed ready.

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

The project ID and project number must match the values from the bootstrap state. Obtain the exact values without exposing credentials:

```bash
terraform -chdir=infra/terraform/bootstrap output -raw staging_project_number
terraform -chdir=infra/terraform/bootstrap output -raw staging_workload_identity_provider
terraform -chdir=infra/terraform/bootstrap output -raw staging_deploy_service_account
terraform -chdir=infra/terraform/bootstrap output -raw terraform_state_bucket
```

These values identify resources and are GitHub environment variables, not secrets.

## Verify keyless authentication first

After the five `staging` environment variables are configured and this workflow is merged, manually run **GCP WIF Verify** from the Actions tab using the `main` branch.

The workflow is deliberately read-only. It:

1. Refuses to run from any ref other than `refs/heads/main`, matching the bootstrap trust condition.
2. Exchanges GitHub's short-lived OIDC token for the `github-deploy` service-account identity.
3. Confirms the active account, project ID and project number.
4. Confirms visibility of the required identity, service-usage, storage and token-exchange APIs.
5. Confirms the protected Terraform state bucket is visible.
6. Records that no GCP resource was changed.

A successful verification is required before running an authenticated Terraform plan or deployment workflow.

## First Terraform validation

Open a pull request and confirm `GCP Terraform Staging` passes. On pull requests this workflow only runs:

```text
terraform fmt -recursive -check
terraform init -backend=false
terraform validate
```

It does not authenticate to GCP and does not apply infrastructure.

## First authenticated Terraform plan

After **GCP WIF Verify** succeeds on `main`, run the `GCP Terraform Staging` workflow manually from the Actions tab.

This initializes the committed GCS backend, reads the shared staging state at `environments/staging`, and performs an authenticated staging plan only. It still does not apply infrastructure. Pull-request validation continues to use `terraform init -backend=false` because untrusted pull-request refs do not receive cloud credentials.

## First infrastructure apply

This PR intentionally does not add automatic Terraform apply. Add apply only after:

```text
Manual GCP bootstrap checklist complete
GitHub staging environment variables configured
GCP WIF Verify succeeds on main
GCS Terraform state bucket exists
Committed staging GCS backend initializes successfully with prefix `environments/staging`
Required least-privilege deploy roles confirmed
Terraform plan reviewed without unexpected resources
```

Do not use local one-off Terraform state for staging infrastructure. The first apply should use a shared state backend.

## First API deployment

After Artifact Registry exists and the deploy service account can push images and deploy Cloud Run, run the `GCP Deploy Staging` workflow manually.

The workflow:

1. Authenticates using Workload Identity Federation.
2. Builds the backend Docker image from the repository root.
3. Pushes the image to Artifact Registry.
4. Deploys the image to Cloud Run.
5. Calls `/health` on the deployed service.

## Minimum deploy service account roles

Start narrow and expand only when a workflow proves it needs more. Expected staging roles include:

```text
roles/artifactregistry.writer
roles/run.admin
roles/iam.serviceAccountUser on the runtime service account
roles/cloudsql.admin for Terraform only, not necessarily for deploy-only workflows
roles/secretmanager.admin for Terraform secret container creation only
roles/serviceusage.serviceUsageAdmin if Terraform manages project API enablement
```

Avoid Owner and Editor roles.

## Cloud SQL connectivity and identity boundary

The unapplied staging design grants only `roles/cloudsql.client` to the runtime and migration service accounts. That role permits connector access; it does not grant Cloud SQL administration or database-level privileges.

When the optional Cloud Run API is eventually enabled, the Cloud SQL connection is mounted at:

```text
/cloudsql/<project>:<region>:<instance>
```

The migration identity can read only the `cdl-database-url` secret container. It cannot read the session-cookie or development-login secret containers. Secret payloads remain absent from Terraform and must be created through the separately controlled credential workflow.

`roles/cloudsql.instanceUser` is intentionally not granted because this design currently expects a rotated database credential rather than IAM database authentication. Cloud Run remains disabled and in memory repository mode, so this change does not deploy or connect an application.

## Cloud SQL recovery baseline

The unapplied staging design uses a zonal `db-f1-micro` PostgreSQL instance with 10 GiB of SSD storage. Automatic storage growth is enabled but capped at 20 GiB to limit surprise cost.

Recovery settings are explicit:

- Daily backups begin at 17:00 UTC.
- Backups stay in `australia-southeast1`.
- Point-in-time recovery retains seven days of transaction logs.
- Eight automated backups are retained, leaving one more backup than log-retention days.
- Deletion protection is enabled in both Terraform and the Cloud SQL API.
- Terraform ignores only automatic `disk_size` growth so it cannot attempt to shrink a live instance.

These settings still require saved-plan and cost review before apply. A successful restore drill remains required before staging is considered proven.

## Logging and alerting baseline

The unapplied staging design includes a bounded observability baseline:

- sustained Cloud SQL CPU above 80% for five minutes;
- Cloud SQL `ERROR`-or-higher log matches;
- Cloud Run `ERROR`-or-higher log matches only when the optional service is enabled.

Notification destinations are references to pre-existing Cloud Monitoring channels and default to none. Terraform does not create recipient addresses or duplicate log sinks. Use `docs/runbooks/gcp-staging-observability.md` for alert filters, operator response, notification ownership, and the controlled post-apply proof procedure.

`terraform validate` proves provider schema only. After an approved apply, each policy still requires a controlled test event and recorded incident evidence before monitoring is considered operationally proven.

## Current limitations

- Artifact Registry tags are immutable. Images must use unique release tags or digests; workflows must not overwrite a floating tag.
- The untagged-image cleanup policy initially runs in dry-run mode with a 14-day threshold. Activating deletion requires plan review and explicit approval after the observed candidates are checked.
- Cloud Run deploys in memory mode first.
- Cloud SQL user/password and `CDL_DATABASE_URL` secret payload are not created by Terraform yet, to avoid storing credentials in Terraform state.
- Terraform apply is intentionally absent until the committed remote state backend and permissions are confirmed by a successful authenticated plan.
- Production is not configured yet.

## Next implementation step

After keyless authentication and the committed remote backend are verified, continue issue #70 with a reviewed saved plan and cost/security assessment before any chargeable apply, then add Cloud SQL runtime wiring, controlled migrations, deterministic seed loading, and rollback evidence.
