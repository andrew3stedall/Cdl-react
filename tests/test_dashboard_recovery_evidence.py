from pathlib import Path

DASHBOARD_PAGE = Path("frontend/src/AnalyticsDashboardPage.tsx")
RECOVERY_SCRIPT = Path("scripts/test-dashboard-recovery.mjs")
SCREENSHOT_WORKFLOW = Path(".github/workflows/app-screenshots.yml")
SCREENSHOT_RUNBOOK = Path("docs/runbooks/github-app-screenshots.md")
RELEASE_INVENTORY = Path("docs/testing/release-candidate-inventory.md")


def test_dashboard_exposes_retry_without_discarding_filter_state() -> None:
    page = DASHBOARD_PAGE.read_text(encoding="utf-8")
    assert "Loading dashboard data" in page
    assert "Unable to load analytics dashboard data from the API." in page
    assert "Retry dashboard" in page
    assert "filtersRef.current = nextFilters" in page
    assert "setReloadRequest((request) => request + 1)" in page


def test_screenshot_workflow_runs_dashboard_recovery_journey() -> None:
    workflow = SCREENSHOT_WORKFLOW.read_text(encoding="utf-8")
    script = RECOVERY_SCRIPT.read_text(encoding="utf-8")
    assert "Test dashboard recovery" in workflow
    assert "node scripts/test-dashboard-recovery.mjs" in workflow
    assert "Loading dashboard data" in script
    assert "Synthetic dashboard backend failure." in script
    assert "Retry dashboard" in script
    assert "River Rangers" in script
    assert "width: 390" in script
    assert "width: 1440" in script


def test_documentation_keeps_dashboard_evidence_boundary_explicit() -> None:
    runbook = SCREENSHOT_RUNBOOK.read_text(encoding="utf-8")
    inventory = RELEASE_INVENTORY.read_text(encoding="utf-8")
    assert "### Dashboard recovery" in runbook
    assert "mocked responses do not prove PostgreSQL persistence" in runbook
    assert "loading, explicit backend failure, retry recovery, filter preservation" in inventory
    assert "Live browser-to-PostgreSQL and staging identity remain separate gates" in inventory
