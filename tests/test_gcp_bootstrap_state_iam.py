from pathlib import Path

BOOTSTRAP = Path("infra/terraform/bootstrap/main.tf")
RUNBOOK = Path("docs/runbooks/gcp-terraform-state-iam-reader.md")


def test_bootstrap_grants_only_state_bucket_iam_policy_read() -> None:
    content = BOOTSTRAP.read_text(encoding="utf-8")

    custom_role = content.split(
        'resource "google_project_iam_custom_role" "terraform_state_iam_viewer"',
        maxsplit=1,
    )[1].split(
        'resource "google_storage_bucket_iam_member" "staging_deploy_state_iam_viewer"',
        maxsplit=1,
    )[0]

    assert 'role_id     = "terraformStateIamViewer"' in custom_role
    assert 'stage       = "GA"' in custom_role
    assert '"storage.buckets.getIamPolicy"' in custom_role
    assert "storage.buckets.setIamPolicy" not in custom_role
    assert "storage.buckets.update" not in custom_role
    assert "storage.buckets.delete" not in custom_role
    assert "storage.objects" not in custom_role

    binding = content.split(
        'resource "google_storage_bucket_iam_member" "staging_deploy_state_iam_viewer"',
        maxsplit=1,
    )[1].split('resource "google_billing_budget" "staging"', maxsplit=1)[0]

    assert "bucket = google_storage_bucket.terraform_state.name" in binding
    assert "role   = google_project_iam_custom_role.terraform_state_iam_viewer.name" in binding
    assert 'member = "serviceAccount:${module.staging.deploy_service_account_email}"' in binding


def test_existing_state_object_access_remains_separate() -> None:
    content = BOOTSTRAP.read_text(encoding="utf-8")

    object_access = content.split(
        'resource "google_storage_bucket_iam_member" "staging_deploy_state_access"',
        maxsplit=1,
    )[1].split(
        'resource "google_project_iam_custom_role" "terraform_state_iam_viewer"',
        maxsplit=1,
    )[0]

    assert 'role   = "roles/storage.objectAdmin"' in object_access
    assert "storage.buckets.getIamPolicy" not in object_access


def test_runbook_documents_reviewed_two_resource_repair() -> None:
    content = RUNBOOK.read_text(encoding="utf-8")

    for phrase in [
        "WIF authentication has already succeeded",
        "storage.buckets.getIamPolicy",
        "2 to add, 0 to change, 0 to destroy",
        "google_project_iam_custom_role.terraform_state_iam_viewer",
        "google_storage_bucket_iam_member.staging_deploy_state_iam_viewer",
        "No changes. Your infrastructure matches the configuration.",
        "Re-run failed jobs",
    ]:
        assert phrase in content

    assert "roles/storage.admin" not in content
    assert "storage.buckets.setIamPolicy" not in content
