from pathlib import Path

STAGING_MAIN_TF = Path("infra/terraform/environments/staging/main.tf")
BUCKET_MODULE_TF = Path("infra/terraform/modules/static-frontend-bucket/main.tf")
RUNBOOK = Path("docs/runbooks/gcp-staging-frontend-hosting.md")


def test_staging_declares_one_labelled_frontend_asset_bucket() -> None:
    content = STAGING_MAIN_TF.read_text(encoding="utf-8")

    for phrase in [
        'frontend_bucket_name   = "${var.project_id}-frontend-assets"',
        '"storage.googleapis.com"',
        'module "frontend_assets"',
        'source = "../../modules/static-frontend-bucket"',
        'component = "frontend"',
    ]:
        assert phrase in content


def test_frontend_bucket_remains_private_and_deletion_safe() -> None:
    content = BUCKET_MODULE_TF.read_text(encoding="utf-8")

    for phrase in [
        "force_destroy               = false",
        'public_access_prevention    = "enforced"',
        "uniform_bucket_level_access = true",
        "enabled = true",
        "labels                      = var.labels",
    ]:
        assert phrase in content

    for forbidden in [
        "allUsers",
        "allAuthenticatedUsers",
        "google_storage_bucket_iam_member",
        "website {",
    ]:
        assert forbidden not in content


def test_frontend_hosting_runbook_preserves_live_action_gates() -> None:
    content = RUNBOOK.read_text(encoding="utf-8")

    for phrase in [
        "asset origin only",
        "does not upload a build",
        "public access prevention set to `enforced`",
        "force_destroy=false",
        "object versioning enabled",
        "no public IAM binding",
        "saved plan and cost summary",
        "A private bucket alone does not satisfy the usable-staging acceptance criterion",
        "issues #70 and #78",
    ]:
        assert phrase in content
