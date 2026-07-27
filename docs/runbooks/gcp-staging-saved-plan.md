# GCP Staging Saved Plan Runbook

## Purpose

This runbook defines the reviewable, apply-free Terraform plan gate for CDL React staging.
It covers the manual `authenticated-plan` job in
`.github/workflows/gcp-terraform-staging.yml`.

The workflow reads the committed remote state and creates a saved Terraform plan on a
trusted `main` run. It never applies infrastructure.

## Prerequisites

Before running the authenticated plan:

1. PR #104 or its successor must be merged into `main`.
2. The GitHub `staging` environment must contain the five documented environment variables.
3. **GCP WIF Verify** must have succeeded on `main` using keyless federation.
4. The protected GCS backend must be readable at the committed
   `environments/staging` prefix.
5. No production approval is implied by a successful staging plan.

The required variables are:

```text
GCP_STAGING_PROJECT_ID
GCP_STAGING_PROJECT_NUMBER
GCP_STAGING_WORKLOAD_IDENTITY_PROVIDER
GCP_STAGING_DEPLOY_SERVICE_ACCOUNT
GCP_TERRAFORM_STATE_BUCKET
```

## Workflow behaviour

The manual workflow:

1. refuses non-`main` refs;
2. validates all five GitHub environment variables;
3. authenticates through Workload Identity Federation;
4. initializes the committed GCS backend;
5. runs `terraform plan` with `-detailed-exitcode` and a saved plan file;
6. renders the saved plan to human-readable text;
7. reads the machine-readable JSON only inside the runner to create a redacted summary;
8. deletes the binary plan and machine-readable JSON before artifact upload;
9. uploads only the human-readable plan and redacted summary for seven days;
10. never runs `terraform apply`.

Terraform exit code `0` means no changes and exit code `2` means a valid plan with changes.
Exit code `1` fails the workflow.

## Evidence retained

The short-lived Actions artifact contains:

```text
staging-plan.txt
staging-plan-summary.md
```

The summary records:

- source commit and workflow run;
- Terraform and plan-format versions;
- SHA-256 of the ephemeral saved plan;
- create, update, delete and replacement counts;
- changed resource addresses and resource types without resource values;
- cost-sensitive resource categories;
- security-sensitive resource categories;
- the automated safety-gate result.

The binary plan and machine-readable JSON are deleted and are never uploaded. This avoids
retaining executable plan material or JSON that could contain sensitive provider values in
a public repository's workflow artifacts.

## Automated safety gates

The summary step blocks the run when it detects either:

- a destructive delete or replacement action; or
- a public IAM principal such as `allUsers` or `allAuthenticatedUsers` in planned values.

A blocked run still uploads the reviewable text and summary when they were generated, so the
cause can be inspected. It does not authorize an apply.

These checks are deliberately narrow. They do not replace a human review of the complete
human-readable plan.

## Human review checklist

Before requesting approval for any live apply, confirm:

- the source SHA is the intended `main` commit;
- the plan reads the expected staging backend and project;
- there are no production resources;
- Cloud SQL remains zonal and within the reviewed tier, disk-growth, backup and PITR bounds;
- Cloud Run remains disabled unless a separately reviewed immutable image and deployment
  decision exist;
- the frontend asset bucket remains private with public access prevention;
- no public IAM member, unexpected role, secret payload or credential appears;
- Artifact Registry retention remains dry-run where documented;
- alerting and notification-channel changes match the approved observability boundary;
- every cost-sensitive category is reviewed against current GCP pricing;
- the total cost and security impact are recorded in issues #70 and #78.

The workflow identifies cost-sensitive resource categories but does not calculate an exact
AUD estimate. Pricing depends on current GCP rates and actual usage, so an explicit cost
assessment remains required before approval.

## Apply boundary

Do not apply the uploaded plan artifact. A future explicitly approved apply workflow must
create a fresh plan from the then-current commit and remote state, present its cost and
security impact, and require the separate live-action approval gate.

No credential creation, database mutation, asset upload, service deployment, public exposure
or production action is part of this workflow.

## Remaining external gate

The repository can define and validate this workflow, but it cannot configure the GitHub
`staging` environment values or prove the live federation exchange without external account
access. When those values are available, run **GCP WIF Verify** first and then run
**GCP Terraform Staging** manually from `main`.
