# Terraform Infrastructure

This folder contains the GCP infrastructure configuration for CDL React.

## Apply order

```text
1. bootstrap/
2. environments/staging/
3. production configuration only after staging is proven
```

`bootstrap/` manages the shared prerequisites around the two existing projects:

- Required Google APIs.
- AUD 25 staging and AUD 50 production budget alerts.
- GitHub deploy service accounts.
- Keyless GitHub Workload Identity Federation restricted to this repository's
  `main` branch.
- A private, versioned GCS bucket for Terraform state.
- Narrow initial staging deploy roles.

It deliberately treats the staging and production projects as existing data.
Terraform will not create, import, replace, or delete either project.

`environments/staging/` manages application infrastructure:

- Artifact Registry.
- Cloud SQL for PostgreSQL.
- Secret Manager containers.
- Runtime and migration service accounts.
- A private frontend asset bucket.
- Cloud Logging and Cloud Monitoring alert policies.
- Optional Cloud Run API service.

Do not apply the staging environment until the bootstrap plan has been reviewed,
applied, and migrated to the GCS backend.

## Bootstrap from Cloud Shell

Follow `docs/runbooks/gcp-terraform-bootstrap.md`. The runbook is written for
phone-accessible Google Cloud Shell and keeps the billing account ID out of Git.

## Validation

```bash
terraform -chdir=infra/terraform/bootstrap fmt -check
terraform -chdir=infra/terraform/bootstrap init -backend=false
terraform -chdir=infra/terraform/bootstrap validate

terraform -chdir=infra/terraform/environments/staging fmt -recursive -check
terraform -chdir=infra/terraform/environments/staging init -backend=false
terraform -chdir=infra/terraform/environments/staging validate
```

## Authenticated saved plan

After the five GitHub `staging` environment variables are configured and **GCP WIF Verify**
succeeds on `main`, manually run **GCP Terraform Staging**. The authenticated job creates an
ephemeral saved plan, uploads only human-readable and redacted review evidence for seven days,
and blocks destructive actions or public IAM principals. It never applies infrastructure.

Use `docs/runbooks/gcp-staging-saved-plan.md` for the evidence, cost-review and security gates.

## State

The first bootstrap apply used local state only long enough to create its
protected state bucket. The committed `bootstrap/backend.tf` now configures the
GCS backend. After that initial apply, run:

```bash
git pull --ff-only
terraform -chdir=infra/terraform/bootstrap init -migrate-state
```

The committed `environments/staging/backend.tf` uses the same protected bucket with the distinct
`environments/staging` prefix. Pull-request validation initializes with `-backend=false`;
authenticated plans on trusted `main` initialize the remote backend and read shared staging state.
