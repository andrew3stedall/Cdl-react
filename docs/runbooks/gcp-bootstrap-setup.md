# GCP Bootstrap Setup Runbook

This runbook captures the manual Google Cloud bootstrap work needed before issue #70 provisions staging infrastructure.

It intentionally stops at account, project, billing, budgets, API enablement, and Workload Identity Federation preparation. Do not manually create Cloud SQL, Cloud Run, Secret Manager secrets, Artifact Registry repositories, or frontend hosting resources unless a later infrastructure issue explicitly moves that work out of IaC.

## Scope

Set up:

```text
Google Cloud account
Cloud Billing account
Staging project
Production project
Budget alerts
Bootstrap APIs
GitHub deploy service accounts
Workload Identity Federation pool and provider
GitHub Actions impersonation bindings
```

Avoid creating:

```text
Cloud SQL instances
Cloud Run services
Secret Manager secrets
Artifact Registry repositories
Frontend hosting buckets or channels
Application runtime IAM roles beyond the bootstrap impersonation binding
```

## Recommended values

Project IDs are globally unique, so adjust the suffix if these are unavailable.

```text
Staging project name: CDL React Staging
Staging project ID:   cdl-react-staging-ast

Production project name: CDL React Production
Production project ID:   cdl-react-prod-ast

Region: australia-southeast1
GitHub repo: andrew3stedall/Cdl-react
```

Use the same region for the initial Cloud Run, Cloud SQL, Artifact Registry, and related resources unless the infrastructure issue documents a different decision.

## Step 1 — Sign in

1. Open Google Cloud Console.
2. Sign in with the Google account that should own the app infrastructure.
3. Use an account you are comfortable attaching billing to. Avoid a throwaway account for long-lived production infrastructure.

## Step 2 — Create or confirm Cloud Billing

1. Open **Billing**.
2. Open **Manage billing accounts**.
3. Create a billing account or confirm an existing one.
4. Add or confirm the payment method.

Record:

```text
Billing account name: ____________________
Billing account ID:   ____________________
```

## Step 3 — Create the staging project

1. Open the project selector.
2. Click **New Project**.
3. Use:

```text
Project name: CDL React Staging
Project ID:   cdl-react-staging-ast
Billing:      selected billing account
```

4. Click **Create**.

## Step 4 — Create the production project

Repeat project creation with:

```text
Project name: CDL React Production
Project ID:   cdl-react-prod-ast
Billing:      same billing account
```

Do not deploy production resources yet. This reserves the project and keeps IAM and billing separated from staging.

## Step 5 — Confirm billing is linked to both projects

1. Open **Billing**.
2. Open the billing account.
3. Open **Account management** or **My projects**.
4. Confirm both projects are linked:

```text
cdl-react-staging-ast
cdl-react-prod-ast
```

If a project is not linked, use the project row action menu, choose **Change billing**, select the billing account, and save.

## Step 6 — Create budget alerts

Create separate budgets for staging and production.

### Staging budget

Suggested starting point:

```text
Budget name: CDL React Staging Budget
Scope:       staging project only
Amount:      AUD 25/month
Thresholds:  50%, 90%, 100%
```

### Production budget

Suggested starting point:

```text
Budget name: CDL React Production Budget
Scope:       production project only
Amount:      AUD 50/month initially
Thresholds:  50%, 90%, 100%
```

Budgets send alerts. They do not hard-stop spend by default.

## Step 7 — Open Cloud Shell

Use Cloud Shell for the bootstrap commands so local SDK setup is not required.

1. Open Cloud Shell from the Google Cloud Console toolbar.
2. Confirm the active account:

```bash
gcloud auth list
```

## Step 8 — Set shell variables

Replace project IDs first if you used different ones.

```bash
export STAGING_PROJECT_ID="cdl-react-staging-ast"
export PROD_PROJECT_ID="cdl-react-prod-ast"
export REGION="australia-southeast1"
export GITHUB_REPO="andrew3stedall/Cdl-react"
```

Check them:

```bash
echo "$STAGING_PROJECT_ID"
echo "$PROD_PROJECT_ID"
echo "$REGION"
echo "$GITHUB_REPO"
```

## Step 9 — Enable bootstrap APIs

Run this for staging:

```bash
gcloud config set project "$STAGING_PROJECT_ID"

gcloud services enable \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com
```

Run this for production:

```bash
gcloud config set project "$PROD_PROJECT_ID"

gcloud services enable \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com
```

## Step 10 — Create deploy service accounts

Create one deploy service account per project.

### Staging

```bash
gcloud config set project "$STAGING_PROJECT_ID"

gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Actions Deploy" \
  --description="Deploys CDL React staging infrastructure and services from GitHub Actions"
```

### Production

```bash
gcloud config set project "$PROD_PROJECT_ID"

gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Actions Deploy" \
  --description="Deploys CDL React production infrastructure and services from GitHub Actions"
```

Record:

```text
Staging deploy service account:
github-deploy@cdl-react-staging-ast.iam.gserviceaccount.com

Production deploy service account:
github-deploy@cdl-react-prod-ast.iam.gserviceaccount.com
```

Adjust the project IDs if you used different ones.

## Step 11 — Do not create service account keys

Do not download JSON keys.

Use Workload Identity Federation so GitHub Actions can obtain short-lived Google Cloud credentials. Long-lived service account keys are unnecessary for this setup.

## Step 12 — Create Workload Identity pools

### Staging

```bash
gcloud config set project "$STAGING_PROJECT_ID"

gcloud iam workload-identity-pools create github-pool \
  --location="global" \
  --display-name="GitHub Actions Pool"
```

### Production

```bash
gcloud config set project "$PROD_PROJECT_ID"

gcloud iam workload-identity-pools create github-pool \
  --location="global" \
  --display-name="GitHub Actions Pool"
```

## Step 13 — Create GitHub OIDC providers

### Staging

```bash
gcloud config set project "$STAGING_PROJECT_ID"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Actions Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="attribute.repository=='andrew3stedall/Cdl-react'"
```

### Production

```bash
gcloud config set project "$PROD_PROJECT_ID"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Actions Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="attribute.repository=='andrew3stedall/Cdl-react'"
```

This trusts only this repository, not all GitHub Actions workflows globally.

## Step 14 — Allow GitHub Actions to impersonate deploy service accounts

First get the project numbers:

```bash
export STAGING_PROJECT_NUMBER="$(gcloud projects describe "$STAGING_PROJECT_ID" --format='value(projectNumber)')"
export PROD_PROJECT_NUMBER="$(gcloud projects describe "$PROD_PROJECT_ID" --format='value(projectNumber)')"

echo "$STAGING_PROJECT_NUMBER"
echo "$PROD_PROJECT_NUMBER"
```

### Staging

```bash
gcloud config set project "$STAGING_PROJECT_ID"

gcloud iam service-accounts add-iam-policy-binding \
  "github-deploy@$STAGING_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$STAGING_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/andrew3stedall/Cdl-react"
```

### Production

```bash
gcloud config set project "$PROD_PROJECT_ID"

gcloud iam service-accounts add-iam-policy-binding \
  "github-deploy@$PROD_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROD_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/andrew3stedall/Cdl-react"
```

This only allows GitHub Actions from the repository to impersonate the deploy service accounts. It does not grant the deploy accounts broad resource permissions.

## Step 15 — Keep deploy roles minimal

Do not grant Owner or Editor roles to the deploy service accounts at this stage.

When issue #70 starts, decide whether infrastructure will be managed by Terraform/OpenTofu or explicit gcloud scripts. Then grant only the roles needed for that approach.

## Step 16 — Record bootstrap outputs

Save these privately:

```text
Billing account name:
Billing account ID:

Staging project ID:
Staging project number:
Staging deploy service account:

Production project ID:
Production project number:
Production deploy service account:

Region:
GitHub repo:
```

Example:

```text
Billing account name: CDL Billing
Billing account ID: 000000-000000-000000

Staging project ID: cdl-react-staging-ast
Staging project number: 123456789012
Staging deploy service account: github-deploy@cdl-react-staging-ast.iam.gserviceaccount.com

Production project ID: cdl-react-prod-ast
Production project number: 987654321098
Production deploy service account: github-deploy@cdl-react-prod-ast.iam.gserviceaccount.com

Region: australia-southeast1
GitHub repo: andrew3stedall/Cdl-react
```

## Completion checklist

```text
Billing account exists
Staging project exists
Production project exists
Billing linked to both projects
Budget alerts created for both projects
Bootstrap APIs enabled
github-deploy service account exists in both projects
Workload Identity pool exists in both projects
GitHub OIDC provider exists in both projects
GitHub repo can impersonate the deploy service accounts
No Cloud SQL instance manually created
No Cloud Run service manually created
No Secret Manager secrets manually created yet
```

## Next repo work

After this bootstrap is ready:

1. Start with issue #60: database architecture decision record.
2. Continue with issue #61: local and CI PostgreSQL foundation.
3. Continue with issue #62: backend database settings and repository factory.
4. Move into issue #70 only once the bootstrap items above are complete.
