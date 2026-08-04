# Review-Controlled GCP Staging Terraform Apply

## Purpose

This runbook defines the controlled apply boundary for issue #111. The workflow
`.github/workflows/gcp-terraform-apply-staging.yml` applies one reviewed cumulative staging
plan while preserving exact source, input, evidence and safety identities.

The workflow does not run automatically. Pull requests perform repository-safe validation only.
A live apply requires a manual `main` dispatch, the protected `staging` environment and explicit
confirmation.

## Required evidence

Before dispatching **GCP Terraform Apply Staging**, all of the following must exist:

1. **GCP WIF Verify** succeeded on `main` using the intended environment.
2. **GCP Terraform Staging** completed for the exact source commit and cumulative stage.
3. Its seven-day artifact contains `staging-plan.txt`, `staging-plan-summary.md` and
   `staging-plan-manifest.json`.
4. The manifest binds the reviewed plan text to the reviewed workflow run ID, exact source
   commit, backend, project, stage, access model, immutable image and Terraform inputs.
5. The summary safety gate is `PASS` and reports no actionable managed reconciliation drift.
   Separately listed non-overlapping refresh differences are permitted only because Terraform
   does not plan to alter those structural paths; they remain visible for human review.
6. The cost/security assessment is complete.
7. Andrew recorded explicit approval against that exact plan, stage, cost and security impact.

A green validation workflow or a blocked plan is not approval.

## Manual inputs

The apply workflow requires:

- `reviewed_plan_run_id`;
- `reviewed_source_sha`;
- `deployment_stage`: `foundation`, `database-jobs`, or `runtime`;
- `access_model`: `private` or `application-login`;
- `backend_image`: empty for foundation, otherwise the immutable Artifact Registry digest;
- the reviewed Google sign-in setting;
- `approval_reference` pointing to the exact issue or PR comment;
- `approval_phrase` matching `APPLY STAGING <stage> <access-model>`;
- explicit `confirm_apply`.

Floating image tags, different projects, stale commits, different inputs and malformed approval
references are rejected.

## Cumulative stages

| Stage | Database jobs | Cloud Run service | Image requirement |
| --- | --- | --- | --- |
| `foundation` | disabled | disabled | empty |
| `database-jobs` | enabled | disabled | immutable digest required |
| `runtime` | enabled | enabled | immutable digest required |

The `application-login` access model is valid only for `runtime`. It preserves the exact
Terraform-managed `allUsers` Cloud Run Invoker exception while the application session boundary
protects non-authenticated API and schema routes. Any other public principal, role, resource or
stage remains blocked.

## Stage prerequisites

The workflow checks Terraform state before recreating a later-stage plan:

- `database-jobs` requires Artifact Registry, frontend storage, Cloud SQL and runtime/migration
  identities;
- `runtime` additionally requires the migration and synthetic-seed Cloud Run jobs.

This prevents a later stage from silently creating unreviewed earlier-stage resources.

## Reviewed plan verification

Before requesting a GCP token, the workflow downloads the exact artifact and verifies:

- `Safety gate: PASS`;
- the exact source commit and reviewed workflow run ID;
- no actionable managed reconciliation under the drift section;
- the expected retention boundary;
- the identity manifest and plan-text hash;
- the exact backend and Terraform inputs.

Non-overlapping refresh differences may be present. They are not treated as apply actions because
the reviewed human-readable plan does not alter those paths. If a drifted path overlaps a managed
update, the plan workflow blocks and this apply workflow cannot start.

## Exact plan recreation

The reviewed artifact intentionally contains no executable plan. The apply workflow:

1. checks out the exact reviewed commit;
2. authenticates through WIF;
3. initializes the protected remote backend;
4. recreates the plan using the exact reviewed inputs;
5. re-runs the deletion, replacement, IAM, allowlist and drift-overlap safety gates;
6. requires an exact text match with the reviewed `staging-plan.txt`;
7. applies only the recreated saved plan.

Any repository, provider, remote-state, input or plan-text difference requires a new plan,
assessment and approval.

## Post-apply proof

After apply, the workflow requires a post-apply no-change plan. It then directly verifies the
resources for the selected stage, including Artifact Registry, service accounts, private frontend
storage, Cloud SQL authorized-network boundaries, Cloud Run jobs and the runtime IAM access model.

Successful Terraform output without the live resource checks is not successful apply evidence.

## Evidence and retention

The retained Markdown evidence records plan/apply run identities, exact source and stage, access
model, image, approval reference, manifest verification, exact text match, apply completion,
post-apply no-change plan and live resource verification.

No executable plan is retained. Binary plans, machine-readable plan JSON and temporary IAM data
are deleted from the runner before the seven-day evidence artifact is uploaded.

## Failure handling

Do not weaken a gate to make an apply pass.

- Missing or expired evidence requires a new authenticated plan.
- A changed `main` commit or input requires a new plan and approval.
- A plan-text mismatch requires reviewing the new plan.
- A destructive action, unexpected public IAM, unreviewed resource type or overlapping actionable
  drift remains blocked.
- Unclassifiable drift remains fail-closed.
- A non-zero post-apply plan requires investigation before migrations, seeding or further rollout.

Production remains out of scope.
