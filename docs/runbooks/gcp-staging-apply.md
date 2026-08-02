# Review-Controlled GCP Staging Terraform Apply

## Purpose

This runbook defines the controlled Terraform apply boundary for issue #111. The workflow
`.github/workflows/gcp-terraform-apply-staging.yml` can apply one previously reviewed,
cumulative staging plan without retaining an executable Terraform plan artifact.

The workflow is repository infrastructure only. Adding it does not perform a live apply.

## Required evidence

Before dispatching **GCP Terraform Apply Staging**, all of the following must exist:

1. **GCP WIF Verify** succeeded on `main` using the intended `staging` environment.
2. **GCP Terraform Staging** succeeded for the exact source commit and deployment stage.
3. Its seven-day artifact contains `staging-plan.txt`, `staging-plan-summary.md` and
   `staging-plan-manifest.json`.
4. The manifest binds the reviewed plan text to the exact source commit, workflow run,
   cumulative stage, backend configuration, image and Terraform inputs.
5. The summary safety gate is `PASS`, reports no remote-state drift, and identifies the
   reviewed workflow run ID and source commit.
6. The cost/security assessment in
   `docs/runbooks/gcp-staging-plan-assessment-template.md` is complete.
7. Andrew has recorded explicit approval in a repository issue or pull-request comment,
   covering that exact plan, stage, cost estimate, and security impact.

A green pull-request validation run is not apply approval.

## Manual inputs

The workflow requires:

- `reviewed_plan_run_id`: the numeric **GCP Terraform Staging** workflow run ID;
- `reviewed_source_sha`: the exact 40-character `main` commit in the reviewed summary;
- `deployment_stage`: `foundation`, `database-jobs`, or `runtime`;
- `access_model`: `private` or `application-login`; the latter is valid only for `runtime`;
- `backend_image`: empty for `foundation`; otherwise the immutable Artifact Registry
  digest URI;
- `approval_reference`: the repository issue or pull-request comment URL containing the
  explicit approval;
- `approval_phrase`: exactly `APPLY STAGING <deployment_stage> <access_model>`; and
- `confirm_apply`: explicitly enabled.

The workflow does not run automatically. Pull requests execute Terraform formatting and
provider-schema validation only. A live apply is possible only from a manual `main` run
with both confirmations present.

## Cumulative deployment stages

The stages are cumulative:

| Stage | Database jobs | Cloud Run | Backend image |
| --- | --- | --- | --- |
| `foundation` | disabled | disabled | must be empty |
| `database-jobs` | enabled | disabled | required immutable digest |
| `runtime` | enabled | enabled | required immutable digest |

For `database-jobs` and `runtime`, the immutable Artifact Registry digest must match:

```text
australia-southeast1-docker.pkg.dev/<staging-project>/cdl-react-backend/cdl-react-app@sha256:<64 hex>
```

Floating tags are rejected. `private` resolves to `allow_public_invoker=false`.
`application-login` resolves to `allow_public_invoker=true` only for `runtime` and requires
the application session boundary described in the staging access ADR.

## Enforced stage order

The workflow refuses to fold an unproven earlier stage into a later apply:

- `foundation` may start from an empty staging application state;
- `database-jobs` requires the Artifact Registry repository, private frontend bucket,
  Cloud SQL instance, and runtime and migration identities to already exist in the
  remote Terraform state; and
- `runtime` additionally requires both controlled Cloud Run database jobs to already
  exist in that state.

A missing state address stops the workflow before the reviewed plan is recreated. This
prevents a `database-jobs` or `runtime` dispatch from silently creating its prerequisites
in the same apply. State presence is not treated as live proof: Terraform refresh and the
exact-plan comparison must still pass.

## Live post-apply verification

Before apply evidence is retained, the workflow verifies the resources appropriate to the
selected cumulative stage directly through authenticated GCP read operations.

Every stage verifies the immutable Artifact Registry repository, runtime and migration
service accounts, private frontend-assets bucket, and Cloud SQL instance. It also confirms
that Cloud SQL has no authorized networks. The database-jobs stage additionally verifies
both migration and synthetic-seed Cloud Run jobs. The runtime stage additionally verifies
the API service and requires its public IAM policy to match the selected access model exactly:
no public member for `private`, or only `roles/run.invoker` for `allUsers` for
`application-login`. `allAuthenticatedUsers` is never accepted.

A successful Terraform command without these live checks does not produce successful apply
evidence. Temporary IAM JSON is deleted and is never uploaded.

## Exact plan identity manifest

Before GCP authentication, the apply workflow reconstructs the expected non-sensitive
manifest from its manual inputs and the checked-out backend configuration. It requires an
exact match with the reviewed artifact, including the plan-text SHA-256, backend bucket and
prefix, backend configuration hash, project, stage, immutable image, feature flags and the
resolved `allow_public_invoker` value.

An altered, cross-stage, cross-project, cross-backend or differently parameterised artifact
fails before Terraform initializes the remote backend or requests a GCP token.

## Exact-plan reproduction boundary

The reviewed artifact intentionally contains no executable plan. The apply workflow:

1. downloads the named artifact from the reviewed workflow run;
2. verifies its `PASS` result, exact source commit, workflow run ID, and no-drift result;
3. refuses to proceed when `main` has advanced beyond the reviewed source commit;
4. checks out that exact commit;
5. recreates a fresh saved plan with the same cumulative stage and image inputs;
6. runs the same redacted safety summary gate;
7. requires the recreated human-readable plan to be an exact text match for the reviewed
   `staging-plan.txt`; and
8. applies only the recreated saved plan that passed those checks.

Any repository, variable, provider, or remote-state change that alters the plan text
blocks the apply and requires a new plan, assessment, and approval.

## Post-apply proof

After Terraform apply completes, the workflow immediately runs the same configuration
with `-detailed-exitcode`. Only exit code `0` is accepted, proving a clean post-apply no-change plan.

The retained seven-day Markdown evidence records:

- reviewed and apply workflow runs;
- source commit and deployment stage;
- selected access model and resolved public-invoker value;
- immutable image identity where applicable;
- approval reference;
- SHA-256 of the reviewed human-readable plan;
- SHA-256 and successful verification of the reviewed identity manifest;
- exact text comparison result;
- apply completion; and
- post-apply no-change result;
- live stage-resource verification; and
- confirmation that Cloud SQL has no authorized networks.

No executable plan is retained. Binary plans and machine-readable plan JSON are deleted
from the runner and are never uploaded.

## Failure handling

Do not weaken a gate to make an apply pass.

- Missing or expired reviewed evidence requires a new authenticated plan.
- A changed `main` commit requires a new plan and approval.
- A plan-text mismatch requires reviewing the new plan.
- Drift, deletion, replacement, unreviewed resource types, or public IAM outside the exact
  runtime `application-login` exception remain blocked by the summary utility.
- A non-zero post-apply plan requires investigation before building images, running
  migrations, or advancing to the next cumulative stage.

## Recommended first live sequence

1. Verify WIF and the state boundary.
2. Plan `foundation`.
3. Complete and approve the cost/security assessment.
4. Apply `foundation`.
5. Confirm the post-apply no-change evidence.
6. Build and publish the immutable backend image.
7. Plan and apply `database-jobs`.
8. Run controlled migrations and deterministic seed loading.
9. Plan and apply `runtime`.
10. Build the login-boundary image, then plan and apply `runtime` with `application-login`.
11. Prove browser login, protected API access, persistence, monitoring, backup, restore,
    and rollback.

Production remains out of scope.
