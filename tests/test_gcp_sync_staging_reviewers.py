from pathlib import Path


WORKFLOW = Path(".github/workflows/gcp-sync-staging-reviewers.yml")


def test_staging_reviewer_sync_requires_three_allowlisted_reviewers() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    assert "three staging reviewers" in content
    assert "if len(emails) != 3" in content
    assert "Exactly three valid reviewer email addresses are required." in content
    assert 'gcloud secrets versions add cdl-google-allowed-emails' in content
    assert 'gcloud run jobs execute "${SYNTHETIC_SEED_JOB}"' in content
    assert "github.ref == 'refs/heads/main'" in content
