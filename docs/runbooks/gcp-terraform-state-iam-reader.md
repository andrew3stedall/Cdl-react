# Terraform State IAM Reader Repair

## Purpose

Use this procedure when **GCP WIF Verify** authenticates successfully as the staging `github-deploy` service account but fails while reading the protected Terraform state bucket IAM policy.

At this point, WIF authentication has already succeeded. The remaining gap is only the read-only `storage.buckets.getIamPolicy` permission required by the verification workflow.

The bootstrap Terraform grants that permission through:

- `google_project_iam_custom_role.terraform_state_iam_viewer`; and
- `google_storage_bucket_iam_member.staging_deploy_state_iam_viewer`.

The custom role contains only `storage.buckets.getIamPolicy`. It does not grant bucket IAM writes, bucket updates, object access, project-wide storage administration, or production access. Existing Terraform state object access remains separately controlled by `roles/storage.objectAdmin` on the single state bucket.

## Apply from Google Cloud Shell

Update the checked-out repository after the pull request is merged:

```bash
cd ~/Cdl-react
git checkout main
git pull --ff-only
```

Confirm the uncommitted bootstrap variables file still exists:

```bash
test -f infra/terraform/bootstrap/terraform.tfvars \
  && echo "terraform.tfvars exists" \
  || echo "terraform.tfvars is missing"
```

Initialise and validate:

```bash
terraform -chdir=infra/terraform/bootstrap init
terraform -chdir=infra/terraform/bootstrap fmt -check
terraform -chdir=infra/terraform/bootstrap validate
```

Create a saved plan:

```bash
terraform -chdir=infra/terraform/bootstrap plan \
  -out=bootstrap-state-iam.tfplan
```

The expected plan is:

```text
Plan: 2 to add, 0 to change, 0 to destroy.
```

The two additions must be exactly:

```text
google_project_iam_custom_role.terraform_state_iam_viewer
google_storage_bucket_iam_member.staging_deploy_state_iam_viewer
```

Stop if Terraform proposes changing or deleting projects, the state bucket, WIF resources, service accounts, budgets, existing IAM bindings, or any production resource.

Inspect the saved plan:

```bash
terraform -chdir=infra/terraform/bootstrap show bootstrap-state-iam.tfplan
```

Apply only the reviewed plan:

```bash
terraform -chdir=infra/terraform/bootstrap apply bootstrap-state-iam.tfplan
```

Verify the bootstrap is converged:

```bash
terraform -chdir=infra/terraform/bootstrap plan
```

Expected result:

```text
No changes. Your infrastructure matches the configuration.
```

## Verify the repair

In GitHub Actions, open the failed **GCP WIF Verify** run and select **Re-run failed jobs**.

A successful run should complete the protected state-bucket boundary check and upload the reviewable verification evidence artifact. Only after that evidence exists should the authenticated staging `foundation` Terraform plan be generated.
