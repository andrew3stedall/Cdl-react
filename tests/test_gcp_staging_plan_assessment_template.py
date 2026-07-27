from pathlib import Path

TEMPLATE = Path("docs/runbooks/gcp-staging-plan-assessment-template.md")


def test_plan_assessment_template_preserves_evidence_and_approval_boundaries() -> None:
    content = TEMPLATE.read_text(encoding="utf-8")

    for phrase in [
        "Source commit SHA",
        "Artifact name and digest",
        "Saved plan SHA-256",
        "evidence assembled from different workflow runs",
        "Delete count",
        "Replacement count",
        "Public access principal detected",
        "Unreviewed resource type detected",
        "Every changed address must have an expected reason",
        "Estimated monthly upper bound (AUD)",
        "Existing staging budget alert (AUD): 25",
        "Cloud SQL deletion protection retained",
        "Artifact Registry cleanup remains dry-run",
        "A successful plan does not prove",
        "PROGRESS TO SEPARATE APPLY REVIEW",
        "generate and review a fresh plan",
    ]:
        assert phrase in content


def test_plan_assessment_template_requires_complete_cost_categories() -> None:
    content = TEMPLATE.read_text(encoding="utf-8")

    for category in [
        "Cloud SQL compute",
        "Cloud SQL storage",
        "Backups and PITR logs",
        "Artifact Registry",
        "Cloud Storage assets and versions",
        "Cloud Run compute, requests and egress",
        "Monitoring logs, metrics and alerts",
        "Other network egress and operations",
    ]:
        assert category in content

    assert "Do not omit backup" in content
    assert "If the upper bound exceeds AUD 25" in content
