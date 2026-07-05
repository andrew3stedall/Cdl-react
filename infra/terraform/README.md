# Terraform Infrastructure

This folder contains the first repository-side GCP infrastructure scaffold for CDL React.

## Current scope

The scaffold is intentionally staging-first and repository-safe:

- Artifact Registry repository for backend container images.
- Cloud SQL for PostgreSQL staging database shell.
- Secret Manager secret containers for runtime configuration.
- Optional Cloud Run API service definition, disabled by default until a real backend image exists.
- Runtime and migration service account foundations.

## Safety gate

Do not run `terraform apply` from a local machine or GitHub Actions until the manual checklist in `docs/runbooks/gcp-bootstrap-setup.md` is complete and the required GitHub environment values are configured.

## Layout

```text
infra/terraform/
  environments/staging/     # first live target
  modules/artifact-registry/
  modules/cloud-run-api/
  modules/cloud-sql-postgres/
  modules/secret-manager/
```

## First validation command

From the repository root:

```bash
terraform -chdir=infra/terraform/environments/staging fmt -recursive -check
terraform -chdir=infra/terraform/environments/staging init -backend=false
terraform -chdir=infra/terraform/environments/staging validate
```

## State backend

The staging environment includes `backend.tf.example`. Copy it to `backend.tf` only after a GCS state bucket has been created and access has been granted to the deploy service account.
