# ADR: First GCP staging runtime as one Cloud Run service

## Status

Accepted for the first review environment. Public exposure is permitted only through the
separately reviewed application-login model in `staging-application-login-adr.md`.

## Context

CDL React needs a stable HTTPS location where the current frontend and PostgreSQL-backed API can be reviewed together. The existing staging design declares Cloud SQL, Artifact Registry, Secret Manager containers, runtime identities and a private frontend asset bucket, but the private bucket is not a usable website endpoint and a split frontend/API deployment would add cross-origin, cookie, TLS and routing decisions before they are needed.

The React clients already use relative `/api` requests. Cloud Run can therefore serve one immutable container containing the Vite build and FastAPI application without changing the browser contract.

## Decision

The first staging environment will use one Cloud Run service:

```text
Cloud Run HTTPS URL
  -> FastAPI
      -> /api/* and /health
      -> React index and immutable /assets/*
  -> Cloud SQL PostgreSQL through the Cloud SQL connector
  -> Secret Manager for CDL_DATABASE_URL and the staging login secret
```

The container image will:

1. build the React application in a Node build stage;
2. install the Python application in a separate runtime stage;
3. copy `frontend/dist` into the runtime image;
4. configure FastAPI to serve the built assets and return `index.html` for non-API client routes;
5. fail startup when a configured frontend build is incomplete.

Terraform will keep Cloud Run disabled until an immutable image exists and a reviewed plan is approved. When enabled, staging will use `CDL_REPOSITORY_MODE=postgres`, the Cloud SQL socket, and Secret Manager references. Secret payloads will not be stored in Terraform state.

## Deployment sequence

1. Merge and run the read-only Workload Identity verification.
2. Generate and review the authenticated Terraform plan.
3. Apply the foundation only after explicit cost and security approval.
4. Build and push an immutable single-service image.
5. Create secret versions through a controlled non-Terraform credential process.
6. Run Alembic and deterministic synthetic seed jobs through the dedicated migration identity.
7. Generate a fresh Terraform plan enabling Cloud Run with the approved image digest.
8. Approve and apply the runtime plan.
9. Verify frontend loading, database-aware readiness, authentication and one persisted workflow.

## Security boundaries

- No service-account keys.
- No secret payloads in Terraform state or retained plan evidence.
- Public invocation defaults to disabled. The staging-only `application-login` model may enable
  it after the global API session boundary, exact IAM exception, plan, and apply are reviewed.
- The runtime identity receives access only to secrets consumed by the service.
- The migration identity remains separate from the runtime identity.
- Cloud SQL deletion protection, backup and point-in-time recovery remain enabled.
- Production is not included.

## Consequences

### Benefits

- One review URL and one rollback unit.
- No CORS or cross-site cookie configuration for the first environment.
- Lower infrastructure and operational complexity than a load balancer/CDN split.
- Frontend and API versions cannot drift independently inside one image.

### Trade-offs

- Frontend and API deploy together.
- Static assets use Cloud Run rather than a CDN.
- A later production-scale architecture may split asset delivery after usage, caching and authentication requirements are known.
- Migration and seed execution must remain controlled jobs; they must not run automatically on every web-service startup.
