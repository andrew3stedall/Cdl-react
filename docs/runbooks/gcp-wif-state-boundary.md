# GCP WIF State Boundary Verification

## Purpose

This note defines the additional read-only evidence required from **GCP WIF Verify** before the first authenticated staging Terraform plan.

The workflow must prove that the configured federation values and Terraform state bucket belong to the intended staging boundary. Visibility alone is insufficient because a readable bucket could be in the wrong project, have weaker protection settings than the applied bootstrap baseline, or contain unexpected IAM bindings.

## Trigger boundary

The workflow runs automatically once when its own workflow file lands on `main`. The push trigger is restricted to:

```text
branch: main
path: .github/workflows/gcp-wif-verify.yml
```

It does not run for pull requests, unrelated pushes, or production refs. A manual `workflow_dispatch` trigger remains available for a manual retry after a configuration correction.

This removes the Actions-tab click from the first read-only proof without turning verification into a recurring deployment workflow. The trusted-ref check still requires `refs/heads/main`, and the job retains only `id-token: write`.

If a required GitHub `staging` environment value is absent, the failed run reports the missing variable names without printing any configured values. This makes the external configuration gap actionable while preserving the credential boundary.

## Required proof

A successful run confirms:

- the Workload Identity provider path contains the configured staging project number;
- the deploy service-account address belongs to the configured staging project ID;
- the active federated account is that exact deploy service account;
- the live project number matches the configured project number;
- the state bucket belongs to the configured staging project number;
- the bucket remains in `australia-southeast1`;
- uniform bucket-level access remains enabled;
- public access prevention remains enforced;
- the bucket IAM policy contains no public IAM principals;
- the deploy service account is the only explicit `roles/storage.objectAdmin` member; and
- object versioning remains enabled.

Any mismatch fails the workflow before an authenticated Terraform plan can be treated as valid evidence. An extra state writer is treated as bootstrap drift rather than accepted as harmless access.

Each failed bucket assertion reports a named boundary check with its expected and actual values. The diagnostic output is limited to non-sensitive resource settings and IAM member identifiers; the raw bucket metadata and policy documents are still neither printed nor retained. This makes project-number, region, uniform-access, public-access-prevention, versioning, public-principal and state-writer drift distinguishable without weakening the gate.

## GitHub token boundary

The verification job requests only `id-token: write`, which is required for short-lived OIDC token minting. It does not request repository contents, pull-request, package, Actions-management, or write permissions. The workflow does not check out the repository and cannot use its GitHub token to read repository contents.

This keeps the GitHub-side permission boundary separate from the short-lived GCP identity being verified. The retained evidence records that the run used this OIDC-only permission set.

## Retained evidence

A successful run uploads one reviewable Markdown artifact for seven days. It records:

- the exact source commit;
- the workflow run URL;
- whether the run used the automatic push trigger or a manual retry;
- the trusted `main` ref;
- the staging project and project number;
- the exact Workload Identity provider path;
- the exact federated service-account identity;
- the exact Terraform state bucket name;
- the OIDC-only GitHub token permission boundary;
- the pass result for each state-bucket protection boundary; and
- confirmation that the workflow changed no GCP resources.

The provider path and bucket name are resource identifiers rather than credentials. Recording them prevents evidence from one valid staging identity or state bucket being mistaken for proof of another configuration.

The artifact contains identifiers and pass results only. The raw bucket metadata and IAM policy are deleted from the runner through an exit trap and are not retained or uploaded. The workflow also fails if the reviewable evidence file is missing, empty, or omits either exact identifier.

## Safety boundary

The verification is read-only. It describes the project, enabled APIs, bucket metadata and bucket IAM policy. It does not create or update buckets, IAM, APIs, service accounts, Terraform state or application resources.

Temporary bucket metadata and IAM JSON files are deleted from the runner through an exit trap, including when a verification assertion fails. The step summary and short-lived artifact record only identifiers and pass/fail protection evidence.

The IAM check covers explicit bucket-policy bindings. Project-level inherited permissions remain visible through the separately reviewed bootstrap project-role design and the authenticated Terraform plan; this workflow does not claim to enumerate every effective permission.

## Operator sequence

1. Confirm the five GitHub `staging` environment variables match the applied bootstrap outputs.
2. Merge the reviewed workflow change; **GCP WIF Verify** then runs automatically once from `main`.
3. If the run reports missing variable names or a named boundary mismatch, correct only that external configuration or live drift and use the manual retry.
4. Confirm the successful artifact records the intended provider path and `gs://` state bucket.
5. Record the seven-day verification artifact and workflow run in issues #70 and #78.
6. Only then run **GCP Terraform Staging** to create the first authenticated saved plan.

A failed boundary check requires correcting the GitHub environment value or reconciling live bootstrap drift before retrying. Do not weaken the check to accommodate an unexpected live state.
