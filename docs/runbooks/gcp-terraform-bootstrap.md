# GCP Terraform Bootstrap

## Purpose

Use Terraform from Google Cloud Shell to finish the CDL React GCP bootstrap
without manually creating APIs, budgets, service accounts, IAM bindings, or
GitHub federation.

The following prerequisites already exist outside Terraform:

- Google account and Cloud Billing account.
- `cdl-react-staging-ast` project with billing enabled.
- `cdl-react-prod-ast` project with billing enabled.
- No Google Cloud organization.

Terraform treats both projects as existing data. It cannot create, replace, or
delete them from this configuration.

## What Terraform creates

```text
Required APIs in staging and production
AUD 25 monthly staging budget alerts
AUD 50 monthly production budget alerts
github-deploy service account in each project
GitHub Workload Identity pool and provider in each project
Repository-scoped, main-branch-only impersonation bindings
Private and versioned GCS Terraform state bucket
Initial staging deployment roles
```

Budget alerts do not stop or cap spending.

## Safety rules

- Never create or download a service-account JSON key.
- Never commit `terraform.tfvars`, Terraform state, or generated credentials.
- Review every plan. Stop if Terraform proposes deleting or replacing either
  GCP project.
- Apply `bootstrap/` before `environments/staging/`.
- Do not apply production application infrastructure from this bootstrap.

## 1. Open Cloud Shell

On a phone, open <https://shell.cloud.google.com> in Chrome and use landscape
orientation if helpful.

Confirm the active account:

```bash
gcloud auth list --filter=status:ACTIVE --format="value(account)"
```

Confirm Terraform:

```bash
terraform version
```

## 2. Enable the provider bootstrap API

Terraform manages the complete API list, but the Service Usage API must be
available before the Google provider can manage other APIs.

```bash
gcloud services enable serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project=cdl-react-staging-ast
```

```bash
gcloud services enable serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project=cdl-react-prod-ast
```

## 3. Clone the repository

After PR #95 is merged:

```bash
git clone https://github.com/andrew3stedall/Cdl-react.git
cd Cdl-react
```

If the repository already exists in Cloud Shell:

```bash
cd Cdl-react
git pull --ff-only
```

## 4. Create the uncommitted variables file

```bash
cp infra/terraform/bootstrap/terraform.tfvars.example \
  infra/terraform/bootstrap/terraform.tfvars
```

Open it:

```bash
nano infra/terraform/bootstrap/terraform.tfvars
```

Replace only:

```text
000000-000000-000000
```

with the billing account ID shown by:

```bash
gcloud billing accounts list \
  --filter="open=true" \
  --format="table(name.basename(),displayName)"
```

Save in nano with `Ctrl+O`, press Enter, then exit with `Ctrl+X`.

## 5. Format and initialise

```bash
terraform -chdir=infra/terraform/bootstrap fmt
```

```bash
terraform -chdir=infra/terraform/bootstrap init
```

## 6. Create and review the plan

```bash
terraform -chdir=infra/terraform/bootstrap plan \
  -out=bootstrap.tfplan
```

The plan should:

- Read both existing projects.
- Enable APIs.
- Create two deploy service accounts.
- Create two Workload Identity pools and providers.
- Create budget alerts.
- Create one state bucket.
- Add IAM bindings.

It must not create, replace, or delete either project. Do not continue if the
plan contains an unexpected deletion or replacement.

## 7. Apply the reviewed plan

```bash
terraform -chdir=infra/terraform/bootstrap apply bootstrap.tfplan
```

This is the first and only bootstrap apply that temporarily uses local state.

## 8. Migrate state to GCS immediately

Pull the committed backend configuration, then migrate the local state:

```bash
git pull --ff-only
terraform -chdir=infra/terraform/bootstrap init -migrate-state
```

Answer `yes` when Terraform asks to copy existing state to the GCS backend.

Verify:

```bash
terraform -chdir=infra/terraform/bootstrap state list
```

## 9. Record the GitHub environment values

```bash
terraform -chdir=infra/terraform/bootstrap output
```

Use the staging outputs for these GitHub environment variables:

```text
GCP_STAGING_PROJECT_ID=cdl-react-staging-ast
GCP_STAGING_PROJECT_NUMBER=<staging_project_number>
GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER=<staging_workload_identity_provider>
GCP_STAGING_DEPLOY_SERVICE_ACCOUNT=<staging_deploy_service_account>
```

The values identify resources; they are not secret keys.

## 10. Recheck drift

```bash
terraform -chdir=infra/terraform/bootstrap plan
```

The expected result is:

```text
No changes. Your infrastructure matches the configuration.
```

Only after that result should the staging application-infrastructure plan be
prepared.
