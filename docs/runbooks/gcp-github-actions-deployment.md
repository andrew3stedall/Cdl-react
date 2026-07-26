# GCP GitHub Actions Deployment Runbook

## Purpose

This runbook explains how to connect GitHub Actions to the CDL React staging GCP project after the manual bootstrap checklist is complete.

Use this with:

- `docs/runbooks/gcp-bootstrap-setup.md`
- `infra/terraform/environments/staging/`
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
```

Expected value shapes:

```text
GCP_STAGING_PROJECT_ID=cdl-react-staging-ast
GCP_STAGING_PROJECT_NUMBER=123456789012
GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER=projects/123456789012/locations/global/workloadIdentityPools/github-pool/providers/github-provider
GCP_STAGING_DEPLOY_SERVICE_ACCOUNT=github-deploy@cdl-react-staging-ast.iam.gserviceaccount.com
```

The project ID and project number must match the values you recorded from the bootstrap runbook.

## First Terraform validation

Open a pull request and confirm `GCP Terraform Staging` passes. On pull requests this workflow only runs:

```text
terraform fmt -recursive -check
terraform init -backend=false
terraform validate
```

It does not authenticate to GCP and does not apply infrastructure.

## First authenticated Terraform plan

After the `staging` GitHub environment variables are configured, run the `GCP Terraform Staging` workflow manually from the Actions tab.

This performs an authenticated staging plan only. It still does not apply infrastructure.

## First infrastructure apply

This PR intentionally does not add automatic Terraform apply. Add apply only after:

```text
Manual GCP bootstrap checklist complete
GitHub staging environment variables configured
GCS Terraform state bucket exists
infra/terraform/environments/staging/backend.tf.example copied to backend.tf
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

## Current limitations

- Cloud Run deploys in memory mode first.
- Cloud SQL user/password and `CDL_DATABASE_URL` secret payload are not created by Terraform yet, to avoid storing credentials in Terraform state.
- Terraform apply is intentionally absent until remote state and permissions are confirmed.
- Production is not configured yet.

## Next implementation step

Once staging bootstrap is complete, finish issue #70 by adding remote state, reviewed Terraform apply, Cloud SQL runtime wiring, migration job execution, and staging rollback notes.
