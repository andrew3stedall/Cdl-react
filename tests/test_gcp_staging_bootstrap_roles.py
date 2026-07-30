from pathlib import Path

BOOTSTRAP = Path("infra/terraform/bootstrap/main.tf")


def _staging_module() -> str:
    content = BOOTSTRAP.read_text(encoding="utf-8")
    return content.split('module "staging" {', maxsplit=1)[1].split(
        'module "production" {', maxsplit=1
    )[0]


def test_staging_deploy_identity_has_required_domain_roles() -> None:
    staging = _staging_module()

    required_roles = {
        "roles/artifactregistry.admin",
        "roles/cloudsql.admin",
        "roles/iam.serviceAccountAdmin",
        "roles/iam.serviceAccountUser",
        "roles/logging.configWriter",
        "roles/monitoring.editor",
        "roles/resourcemanager.projectIamAdmin",
        "roles/run.admin",
        "roles/secretmanager.admin",
        "roles/serviceusage.serviceUsageAdmin",
        "roles/storage.admin",
        "roles/viewer",
    }

    for role in required_roles:
        assert f'"{role}"' in staging

    assert '"roles/artifactregistry.writer"' not in staging


def test_staging_deploy_identity_is_not_project_owner_or_editor() -> None:
    staging = _staging_module()

    assert '"roles/owner"' not in staging
    assert '"roles/editor"' not in staging
