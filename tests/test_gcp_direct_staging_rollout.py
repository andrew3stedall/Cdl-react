from pathlib import Path

WORKFLOW = Path(".github/workflows/gcp-direct-staging-rollout.yml")


def test_direct_rollout_repairs_the_cloud_sql_attachment_used_by_the_secret() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    for phrase in (
        "Repair database attachment for the active staging secret",
        "gcloud secrets versions access latest",
        "--secret cdl-database-url",
        "host=/cloudsql/",
        "gcloud sql instances describe",
        'test "${state}" = "RUNNABLE"',
        "--add-cloudsql-instances",
        'gcloud run services update "${SERVICE_NAME}"',
        "cdl-react-staging-db-migrate",
        "cdl-react-staging-synthetic-seed",
        "cdl-react-staging-fpl-refresh",
    ):
        assert phrase in content


def test_direct_rollout_stays_bound_to_staging() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    assert "PROJECT_ID: cdl-react-staging-ast" in content
    assert 'test "${PROJECT_ID}" = "cdl-react-staging-ast"' in content
    assert "cdl-react-prod" not in content


def test_failure_fallback_requires_manual_or_explicit_request_and_migration_gate() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    assert "workflow_dispatch:" in content
    assert "Run and verify migrations before changing application traffic" in content
    assert 'gcloud run jobs execute "${migration_job}"' in content
    assert 'test "${migration_image}" = "${IMAGE_DIGEST_URI}"' in content
    assert "--no-traffic" in content
    assert "update-traffic" in content
    assert "if: >-" in content
