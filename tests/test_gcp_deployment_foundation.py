from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_gcp_deployment_foundation_files_exist() -> None:
    expected_paths = [
        "Dockerfile",
        ".dockerignore",
        ".github/workflows/gcp-terraform-staging.yml",
        ".github/workflows/gcp-deploy-staging.yml",
        "infra/terraform/environments/staging/main.tf",
        "infra/terraform/environments/staging/backend.tf.example",
        "infra/terraform/modules/artifact-registry/main.tf",
        "infra/terraform/modules/cloud-run-api/main.tf",
        "infra/terraform/modules/cloud-sql-postgres/main.tf",
        "infra/terraform/modules/secret-manager/main.tf",
        "docs/runbooks/gcp-github-actions-deployment.md",
    ]

    for relative_path in expected_paths:
        assert (ROOT / relative_path).exists(), relative_path


def test_gcp_deployment_foundation_keeps_apply_gated() -> None:
    terraform_workflow = read(".github/workflows/gcp-terraform-staging.yml")
    deployment_runbook = read("docs/runbooks/gcp-github-actions-deployment.md")
    bootstrap_runbook = read("docs/runbooks/gcp-bootstrap-setup.md")

    assert "terraform validate" in terraform_workflow
    assert "Terraform apply is not automated yet" in deployment_runbook
    assert "Do not run `terraform apply`" in read("infra/terraform/README.md")
    assert "No Cloud SQL instance manually created" in bootstrap_runbook


def test_gcp_deploy_uses_workload_identity_not_keys() -> None:
    deploy_workflow = read(".github/workflows/gcp-deploy-staging.yml")
    terraform_workflow = read(".github/workflows/gcp-terraform-staging.yml")
    dockerignore = read(".dockerignore")

    assert "google-github-actions/auth@v3" in deploy_workflow
    assert "google-github-actions/auth@v3" in terraform_workflow
    assert "workload_identity_provider" in deploy_workflow
    assert "credentials_json" not in deploy_workflow
    assert "credentials_json" not in terraform_workflow
    assert "gha-creds-*.json" in dockerignore


def test_cloud_run_starts_in_memory_mode() -> None:
    deploy_workflow = read(".github/workflows/gcp-deploy-staging.yml")
    staging_variables = read("infra/terraform/environments/staging/variables.tf")
    staging_main = read("infra/terraform/environments/staging/main.tf")

    assert "CDL_REPOSITORY_MODE=memory" in deploy_workflow
    assert "default     = false" in staging_variables
    assert "repository_mode               = \"memory\"" in staging_main
