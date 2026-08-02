# GCP Staging Frontend Hosting

## Purpose

This runbook defines the first staging frontend delivery boundary.

The first review environment serves the React build from the same immutable Cloud Run image as FastAPI. The existing private Cloud Storage bucket remains a Terraform-managed asset origin only, but it is not the first website endpoint and is not required for the single-service review URL.

See:

- `docs/architecture/gcp-single-service-staging.md`
- `docs/runbooks/gcp-github-actions-deployment.md`
- `infra/terraform/modules/static-frontend-bucket/`
- `infra/terraform/environments/staging/main.tf`

## First review delivery path

```text
Cloud Run HTTPS origin
  -> /assets/* from the bundled Vite build
  -> client routes return frontend index.html
  -> /api/* remains FastAPI
  -> /health remains FastAPI
```

The frontend uses relative `/api` requests, so the first environment does not require a separate frontend hostname, CORS policy or cross-site session-cookie design.

The image build must:

1. run the Vite production build;
2. copy `frontend/dist` into the Python runtime image;
3. configure `CDL_FRONTEND_DIST_DIR`;
4. serve immutable asset files directly;
5. return `index.html` for non-API client routes;
6. preserve 404 responses for unknown `/api` routes;
7. fail startup when a configured frontend build lacks `index.html`.

## Private asset bucket

Terraform still declares a regional private bucket through:

- `infra/terraform/modules/static-frontend-bucket/`
- `infra/terraform/environments/staging/main.tf`
- `infra/terraform/environments/staging/outputs.tf`

It is retained for later asset-origin, export, rollback or split-hosting evaluation. It does not upload a build, create a load balancer or CDN, assign a custom domain, grant public access or provide a usable website.

The bucket security baseline remains:

- uniform bucket-level access;
- public access prevention set to `enforced`;
- no `allUsers` or `allAuthenticatedUsers` IAM member;
- `force_destroy=false`;
- object versioning enabled;
- staging cost-attribution labels.

Do not add object ACLs or relax public access prevention merely because the first frontend now runs through Cloud Run.

## Terraform outputs

The staging environment exposes:

```text
frontend_asset_bucket_name
frontend_asset_bucket_url
```

These identify a private bucket and `gs://` URL. They contain no credential, signed URL or public hostname. The bucket URL is not a public website endpoint.

The tester-facing URL comes from the Terraform-managed Cloud Run service. Normal browser
access requires the reviewed `application-login` runtime model: the React login bootstrap and
health route are public, while all other API and schema routes require a valid secure session.

## Cost boundary

Serving the small first frontend through Cloud Run avoids adding an external HTTPS load balancer, CDN or separate managed-hosting product before usage and caching requirements are known. Static requests still consume Cloud Run requests and possible egress, which must be included in the cost assessment.

The private bucket can also incur storage and operation charges after an approved foundation apply. Its versioning impact must remain visible even when it is not used for active delivery.

The first design deliberately excludes:

- Cloud CDN and an external HTTPS load balancer;
- Firebase Hosting configuration;
- a custom domain or managed certificate;
- cross-region replication;
- automatic public bucket IAM;
- a second frontend deployment workflow.

## Validation before apply

Pull-request validation must prove:

```text
terraform fmt -recursive -check
terraform init -backend=false
terraform validate
frontend lint, tests and build
backend lint, tests and packaging contracts
```

The saved plan and cost summary must confirm:

1. the private bucket retains public access prevention, versioning and deletion safety;
2. the Cloud Run service remains disabled during the foundation plan;
3. a later runtime plan uses one immutable frontend-and-API image digest;
4. `CDL_REPOSITORY_MODE=postgres` is configured for that service;
5. the frontend and API share one origin;
6. no public IAM binding is introduced without a separate access decision;
7. no load balancer, CDN, DNS record or production resource is present;
8. the old imperative memory-mode deployment path is absent.

## Controlled deployment sequence

1. Apply the reviewed foundation with Cloud Run disabled.
2. Create runtime secret versions outside Terraform state.
3. Run controlled migrations and deterministic synthetic seed loading.
4. Run **GCP Build Staging Image** to build and push the single-service image.
5. Record its immutable digest URI.
6. Generate a fresh Terraform runtime plan with that digest and `access_model=application-login`.
7. Review the exact image update and one `allUsers` Cloud Run Invoker binding.
8. Approve and apply that runtime plan using
   `APPLY STAGING runtime application-login`.
9. Verify root loading, client routes, login/logout, anonymous API rejection and one persisted workflow.
10. Record rollback and monitoring evidence in issues #70 and #78.

A private bucket alone does not satisfy the usable-staging acceptance criterion. The shared
staging password is a review-only control for synthetic data, not a production identity model.
