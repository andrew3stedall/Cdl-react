# GCP Staging Saved Plan Runbook

## Purpose

This runbook defines the reviewable, apply-free Terraform plan gate for CDL React staging.
It covers the manual `authenticated-plan` job in
`.github/workflows/gcp-terraform-staging.yml` and never applies infrastructure.

The workflow reads the committed remote state, refreshes live provider state and creates a
saved Terraform plan on a trusted `main` run. The evidence is suitable for human review but
is not itself executable apply material.

## Prerequisites

Before running the authenticated plan:

1. The GitHub `staging` environment contains the documented project, WIF, service-account and
   protected-state-bucket variables.
2. **GCP WIF Verify** has succeeded on `main` using keyless federation.
3. The protected GCS backend is readable at the committed `environments/staging` prefix.
4. The intended cumulative stage, access model, Google sign-in setting and immutable image
   digest are known.
5. No production approval is implied by a successful staging plan.

## Workflow behaviour

The manual workflow:

1. refuses non-`main` refs;
2. validates the protected environment variables;
3. authenticates through Workload Identity Federation;
4. initializes the committed GCS backend;
5. runs `terraform plan` with `-detailed-exitcode` and a temporary saved plan;
6. renders complete human-readable plan and redacted summary evidence;
7. inspects the machine-readable plan only inside the runner;
8. verifies every changed resource type belongs to the reviewed staging design;
9. classifies out-of-band resource drift by comparing its structural paths with the paths
   Terraform proposes to change;
10. creates a non-sensitive identity manifest binding the plan to the source commit, workflow
    run, backend, cumulative stage, immutable image and exact Terraform inputs;
11. ensures the binary plan and machine-readable JSON are deleted before upload;
12. uploads the complete human-readable plan and redacted summary plus manifest for seven days;
13. never runs `terraform apply`.

Terraform exit code `0` means no managed change and exit code `2` means a valid plan with
managed changes. Exit code `1` fails the workflow.

## Drift classification

Terraform `resource_drift` includes both genuine configuration drift and provider-computed
state normalization. Treating every refresh difference as actionable causes unrelated image
updates to be blocked by timestamps, generated identifiers, certificates, observed status or
other fields Terraform does not intend to reconcile.

The gate therefore compares redacted structural paths, never values:

- **Actionable managed reconciliation** — a drifted path overlaps a path Terraform plans to
  update on the same resource, the same resource is being created/deleted/replaced, or the
  change shape cannot be classified safely. This remains fail-closed whenever the plan has
  managed changes.
- **Non-overlapping refresh difference** — the live refresh changed a field that Terraform does
  not plan to change. It remains visible in the summary but does not block an unrelated managed
  update and is not applied or reconciled by that plan.

A manually changed managed setting such as Cloud SQL deletion protection overlaps the planned
reconciliation path and remains blocked. A provider-updated status field alongside a Cloud Run
image change does not overlap the image path and can pass after human review.

Only resource addresses, types, actions and classification are retained. Attribute names and
values are omitted from uploaded evidence.

## Evidence retained

The short-lived artifact contains:

```text
staging-plan.txt
staging-plan-summary.md
staging-plan-manifest.json
```

The summary records source identity, Terraform versions, hashes, create/update/delete counts,
changed resource addresses and types, actionable drift, non-overlapping refresh differences,
resource allowlist status, cost-sensitive resource categories, security-sensitive categories
and the automated safety-gate result.

The binary plan and machine-readable JSON are deleted and never uploaded. Artifact publication
is fail-closed: incomplete evidence is never uploaded, and a blocked plan is evidence only—not
apply authorization.

## Automated safety gates

The plan remains blocked when it detects any of:

- a destructive delete or replacement action;
- a public IAM principal such as `allUsers` or `allAuthenticatedUsers`, except the exact reviewed
  staging `application-login` Cloud Run Invoker binding;
- an unreviewed Terraform resource type;
- actionable out-of-band resource drift that overlaps managed reconciliation;
- drift or managed-change shapes that cannot be classified safely.

Non-overlapping refresh differences do not weaken these gates. They are separately listed so a
reviewer can confirm they are not part of the proposed managed change.

## Human review checklist

Before requesting live apply approval, confirm:

- the source SHA, workflow run, project and backend are exact;
- the intended immutable image and cumulative stage are correct;
- actionable managed drift is reported as none;
- every non-overlapping refresh difference is understood as outside the fields this plan changes;
- the complete human-readable plan contains no hidden extra update;
- there is no delete, replacement, production resource or unexpected public IAM;
- Cloud SQL, Cloud Run, storage, secrets, monitoring and cost-sensitive resource categories stay
  within the previously reviewed staging boundaries;
- the cost and security impact are recorded with the approval reference.

## Apply boundary

The uploaded binary plan is deliberately unavailable. The protected apply workflow downloads
review evidence, verifies the manifest, recreates the plan at the exact commit and inputs,
re-runs this safety gate, requires an exact human-readable plan-text match, and applies only the
recreated saved plan.

A changed repository, variable, provider result, backend state, image, drift classification or
plan text requires a new plan and approval. No credential creation, database job execution,
seed execution, production action or public-access expansion is performed by this workflow.
