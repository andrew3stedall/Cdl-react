from pathlib import Path

WORKFLOW = Path(".github/workflows/gcp-terraform-apply-staging.yml")


def test_apply_workflow_installs_cloud_sdk_before_live_verification() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    setup_index = content.index("- name: Set up Cloud SDK")
    verify_index = content.index("- name: Verify applied stage resources and access boundary")

    assert setup_index < verify_index
    assert "google-github-actions/setup-gcloud@v3" in content
    assert 'version: ">= 416.0.0"' in content
