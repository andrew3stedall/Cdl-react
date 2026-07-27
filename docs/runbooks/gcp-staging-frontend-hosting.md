# GCP Staging Frontend Hosting

## Purpose

This runbook defines the first cost-conscious hosting foundation for built CDL React frontend assets.

Terraform declares a regional Cloud Storage bucket through:

- `infra/terraform/modules/static-frontend-bucket/`
- `infra/terraform/environments/staging/main.tf`
- `infra/terraform/environments/staging/outputs.tf`

The bucket is an asset origin only. This change does not upload a build, create a load balancer or CDN, assign a custom domain, grant public access, or deploy a usable website.

## Security baseline

The bucket is configured with:

- uniform bucket-level access;
- public access prevention set to `enforced`;
- no `allUsers` or `allAuthenticatedUsers` IAM member;
- `force_destroy=false` so Terraform cannot silently delete stored assets;
- object versioning enabled;
- the shared staging cost-attribution labels, including `component=frontend`.

Do not add object-level ACLs. Do not relax public access prevention until the staging authentication, ingress and frontend delivery design has been reviewed and explicitly approved.

## Terraform outputs

The staging environment exposes:

```text
frontend_asset_bucket_name
frontend_asset_bucket_url
```

`frontend_asset_bucket_name` is the authoritative bucket name for later keyless upload workflows. `frontend_asset_bucket_url` is the private `gs://` resource URL. It is not a public website endpoint and must not be presented to testers as a usable application URL.

Later workflows should read these values from the reviewed Terraform state or approved workflow configuration rather than duplicating the bucket name in scripts. The outputs contain no credential, signed URL, public hostname or secret payload.

## Cost boundary

Cloud Storage is selected as the lowest-complexity asset origin for the current staging scale. The bucket can incur storage and operation charges after an approved apply, but this repository change creates no live resource.

The initial design deliberately excludes:

- Cloud CDN and an external HTTPS load balancer;
- Firebase Hosting project configuration;
- a custom domain or managed certificate;
- cross-region replication;
- automatic public website IAM;
- build upload or cache-invalidation jobs.

Before apply, the saved plan and cost summary must identify the bucket, its region, expected asset size, versioning impact and any later delivery layer proposed above it.

## Validation before apply

Pull-request validation must prove:

```text
terraform fmt -recursive -check
terraform init -backend=false
terraform validate
```

Review the plan and confirm:

1. exactly one staging frontend bucket is proposed;
2. its name is derived from the staging project ID;
3. `public_access_prevention` remains `enforced`;
4. uniform bucket-level access and versioning remain enabled;
5. `force_destroy` remains false;
6. no public IAM binding, load balancer, CDN, DNS record or production resource is present;
7. the bucket carries `application`, `environment`, `managed_by` and `component=frontend` labels;
8. the two frontend outputs resolve only to the planned private bucket name and `gs://` URL.

## Controlled deployment sequence

After an explicitly approved infrastructure apply:

1. read the authoritative bucket output through the trusted Terraform workflow;
2. build the frontend with the reviewed staging API configuration;
3. upload immutable, content-hashed assets through keyless GitHub Actions;
4. retain `index.html` as the only short-cache entry;
5. verify the uploaded object inventory and labels;
6. select the delivery and authentication boundary before granting any public access;
7. add frontend loading and API connectivity smoke tests;
8. record evidence in issues #70 and #78.

A private bucket alone does not satisfy the usable-staging acceptance criterion. The later delivery layer must be reviewed for authentication, TLS, cache behaviour, cost and rollback before staging is exposed.
