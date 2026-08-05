# 2026-08-05 — Automatic staging rollout and official FPL refresh

## Summary

CDL React staging can now roll a green `main` commit through an immutable image build, a fail-closed Terraform apply, Alembic migration execution, official FPL refresh, and live health verification without a separate manual workflow dispatch.

## Safety boundary

The automatic Terraform plan remains subject to the existing staging plan summary gate. It is additionally restricted to:

- in-place image updates for the migration job;
- in-place image updates for the deterministic synthetic-seed job definition;
- creation or in-place image updates for the official FPL refresh job; and
- in-place image updates for the single Cloud Run application service.

Any deletion, replacement, production reference, unrelated resource change, or failed post-apply no-change plan stops the rollout.

## Runtime sequence

1. Build the frontend and API into one immutable image.
2. Push the image to the staging Artifact Registry and resolve its digest.
3. Plan and apply the allowlisted runtime changes.
4. Run Alembic migrations.
5. Run the official FPL `bootstrap-static` and `fixtures` refresh job.
6. Require non-empty normalized teams, players, and fixtures.
7. Verify the live health endpoint and the unauthenticated FPL API boundary.
8. Retain plan, image, health, service URL, and rollout evidence for 14 days.

The synthetic seed job remains deployed for explicit test-data operations but is not executed by automatic rollouts.
