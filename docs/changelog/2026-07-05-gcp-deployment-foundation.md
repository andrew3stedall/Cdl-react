# 2026-07-05 — GCP Deployment Foundation

## Summary

Added the first repository-side staging deployment foundation for GCP.

## Added

- Cloud Run-ready backend `Dockerfile`.
- Docker ignore rules for local environment files, Terraform state, and generated GitHub auth credentials.
- Staging Terraform environment scaffold under `infra/terraform/environments/staging/`.
- Terraform modules for Artifact Registry, Cloud SQL PostgreSQL, Secret Manager, and Cloud Run API.
- Pull-request Terraform format and validation workflow.
- Manual staging deployment workflow for Docker build, Artifact Registry push, Cloud Run deploy, and `/health` smoke check.
- GCP GitHub Actions deployment runbook.

## Safety notes

- Terraform apply is not automated yet.
- Cloud Run creation through Terraform is disabled by default.
- The deploy workflow is manual and requires the `staging` GitHub environment values from the GCP bootstrap runbook.
- Runtime remains in `memory` repository mode until PostgreSQL migrations, runtime secrets, and repository wiring are ready.

## Related work

- Issue #70: Bootstrap GCP infrastructure for staging.
- Issue #78: GCP staging and production readiness milestone.
