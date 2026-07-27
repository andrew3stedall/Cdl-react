# GCP Staging Plan Assessment Template

## Purpose

Use this template to review one authenticated staging Terraform plan before any request to apply infrastructure. A completed assessment supports issues #70 and #78 but is not approval to apply.

## Plan identity

Record these values from one successful workflow run:

- Assessment date (UTC):
- Reviewer:
- Source commit SHA:
- Workflow run URL:
- Artifact name and digest:
- Saved plan SHA-256:
- Terraform version and plan format version:
- Terraform detailed exit code:

Reject evidence assembled from different workflow runs or missing any identity field.

## Automated gate result

- Safety gate: PASS / BLOCKED
- Create count:
- Update count:
- Delete count:
- Replacement count:
- Remote-state drift detected: yes / no
- Public access principal detected: yes / no
- Unreviewed resource type detected: yes / no

A delete, replacement, remote-state drift, public access principal, unreviewed resource type, failed check, or missing evidence field blocks progression.

## Changed resources

| Action | Resource type | Resource address | Expected reason | Reviewed |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

Every changed address must have an expected reason traceable to reviewed repository configuration.

## Drift assessment

| Drift action | Resource type | Resource address | External cause | Reconciliation evidence |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

Every drifted address must have an explained external cause and reconciliation evidence. Generate a fresh plan after reconciliation; do not progress using an assessment that records unresolved drift.

## Cost assessment

Use current Google Cloud pricing for the configured region. State the pricing-check date and estimate in AUD.

| Category | Planned configuration | Pricing basis and date | Monthly AUD estimate | Upper-bound assumption |
| --- | --- | --- | --- | --- |
| Cloud SQL compute |  |  |  |  |
| Cloud SQL storage |  |  |  |  |
| Backups and PITR logs |  |  |  |  |
| Artifact Registry |  |  |  |  |
| Cloud Storage assets and versions |  |  |  |  |
| Cloud Run compute, requests and egress |  |  |  |  |
| Monitoring logs, metrics and alerts |  |  |  |  |
| Other network egress and operations |  |  |  |  |

- Estimated fixed monthly baseline (AUD):
- Estimated usage-dependent monthly amount (AUD):
- Estimated monthly upper bound (AUD):
- Existing staging budget alert (AUD): 25
- Estimate within budget alert: yes / no

Do not omit backup, transaction-log, versioned-object, log-ingestion, operation, or egress costs because they depend on usage. If the upper bound exceeds AUD 25, record the discrepancy and obtain an explicit billing decision before apply.

## Security assessment

- Target project is staging only: yes / no
- Production resources referenced: yes / no
- Public access principal present: yes / no
- Storage public access prevention retained: yes / no
- Uniform bucket-level access retained: yes / no
- Cloud Run service enabled: yes / no
- Cloud Run public ingress enabled: yes / no
- Runtime repository mode remains memory: yes / no
- Sensitive values appear in retained evidence: yes / no
- Unexpected IAM roles or members: yes / no
- Cloud SQL deletion protection retained: yes / no
- Cloud SQL remains zonal and cost-bounded: yes / no
- Artifact Registry cleanup remains dry-run: yes / no
- Monitoring recipients created by Terraform: yes / no

Any public access, production reference, sensitive value, destructive action, unresolved drift, disabled deletion protection, unexpected IAM grant, or unexplained security-sensitive change blocks progression.

## Operational boundary

A successful plan does not prove migration execution, seed loading, deployment, database connectivity, restore, alert delivery, or persistence across restart. Record each as pending unless separate evidence exists.

## Decision

- Decision: PROGRESS TO SEPARATE APPLY REVIEW / REJECT / REVISE AND REPLAN
- Decision date (UTC):
- Reviewer:
- Blocking findings:
- Required follow-up:
- Evidence invalidated by repository or remote-state change: acknowledged yes / no

Any later apply must generate and review a fresh plan from the then-current commit and remote state.
