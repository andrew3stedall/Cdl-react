# 2026-07-26 — Terraform-managed GCP bootstrap

## Summary

Replaced the remaining manual GCP bootstrap path with a Terraform configuration
that works with the existing staging and production projects.

## Added

- Required API enablement for both projects.
- Separate staging and production budget alerts.
- Keyless GitHub deploy service accounts and Workload Identity Federation.
- Repository and `main` branch restrictions on GitHub OIDC trust.
- Private, versioned GCS remote-state storage with deletion protection.
- Phone-friendly Google Cloud Shell bootstrap and state-migration runbook.

## Safety

- Existing projects are data sources and cannot be deleted by this configuration.
- No service-account keys are created.
- Production application infrastructure is not provisioned.
- Terraform apply remains manual and plan-gated.
