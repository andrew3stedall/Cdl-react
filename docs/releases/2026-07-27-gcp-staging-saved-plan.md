# GCP staging saved-plan gate

## Summary

The manual authenticated staging Terraform workflow now creates reviewable plan evidence without
retaining executable or machine-readable plan files.

## Added

- A saved-plan workflow using Terraform's detailed exit code and committed remote backend.
- A redacted summary of resource actions, cost-sensitive categories and security-sensitive
  categories.
- Automated blocking for deletes, replacements and public IAM principals.
- Seven-day retention for the human-readable plan and redacted summary only.
- Operator guidance for cost, security and apply approval.

## Safety boundary

The workflow does not run `terraform apply`. The binary plan and JSON representation are deleted
before artifact upload. Live authentication, remote-state access and an actual staging plan remain
external gates until the GitHub `staging` environment variables are configured and **GCP WIF
Verify** succeeds on `main`.
