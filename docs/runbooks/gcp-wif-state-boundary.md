# GCP WIF State Boundary Verification

## Purpose

This note defines the additional read-only evidence required from **GCP WIF Verify** before the first authenticated staging Terraform plan.

The workflow must prove that the configured federation values and Terraform state bucket belong to the intended staging boundary. Visibility alone is insufficient because a readable bucket could be in the wrong project, have weaker protection settings than the applied bootstrap baseline, or contain unexpected IAM bindings.

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

## Retained evidence

A successful run uploads one reviewable Markdown artifact for seven days. It records:

- the exact source commit;
- the workflow run URL;
- the trusted `main` ref;
- the staging project, project number and federated service-account identity;
- the pass result for each state-bucket protection boundary; and
- confirmation that the workflow changed no GCP resources.

The artifact contains identifiers and pass results only. The raw bucket metadata and IAM policy are deleted from the runner through an exit trap and are not retained or uploaded. The workflow also fails if the reviewable evidence file is missing or empty.

## Safety boundary

The verification is read-only. It describes the project, enabled APIs, bucket metadata and bucket IAM policy. It does not create or update buckets, IAM, APIs, service accounts, Terraform state or application resources.

Temporary bucket metadata and IAM JSON files are deleted from the runner through an exit trap, including when a verification assertion fails. The step summary and short-lived artifact record only identifiers and pass/fail protection evidence.

The IAM check covers explicit bucket-policy bindings. Project-level inherited permissions remain visible through the separately reviewed bootstrap project-role design and the authenticated Terraform plan; this workflow does not claim to enumerate every effective permission.

## Operator sequence

1. Confirm the five GitHub `staging` environment variables match the applied bootstrap outputs.
2. Run **GCP WIF Verify** manually from `main`.
3. Retain the seven-day verification artifact and record its workflow run in issues #70 and #78.
4. Only then run **GCP Terraform Staging** to create the first authenticated saved plan.

A failed boundary check requires correcting the GitHub environment value or reconciling live bootstrap drift before retrying. Do not weaken the check to accommodate an unexpected live state.
