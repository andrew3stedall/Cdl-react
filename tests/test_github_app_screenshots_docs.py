from pathlib import Path

RUNBOOK = Path("docs/runbooks/github-app-screenshots.md")
WORKFLOW = Path(".github/workflows/app-screenshots.yml")
SCRIPT = Path("scripts/capture-app-screenshots.mjs")
INTERACTION_SCRIPT = Path("scripts/test-app-interactions.mjs")
LEAGUE_PAGE = Path("frontend/src/LeaguePage.tsx")
STYLES = Path("frontend/src/styles.css")


def test_screenshot_runbook_explains_github_artifacts() -> None:
    content = RUNBOOK.read_text(encoding="utf-8")

    assert "App Screenshots" in content
    assert "app-screenshots" in content
    assert "does not require GCP" in content
    assert "/team-selection" in content
    assert "mobile" in content
    assert "tablet" in content
    assert "desktop" in content
    assert "horizontal overflow" in content


def test_screenshot_workflow_uploads_artifact_without_deploying() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    assert "actions/upload-artifact" in content
    assert "axe-core" in content
    assert "Test primary interactions" in content
    assert "node scripts/test-app-interactions.mjs" in content
    assert "Capture screenshots" in content
    assert "deployment" not in content.lower()


def test_screenshot_script_captures_core_routes() -> None:
    content = SCRIPT.read_text(encoding="utf-8")

    for route in ["/", "/league", "/dashboard", "/fdr", "/squad-management", "/team-selection"]:
        assert route in content

    assert "chromium.launch" in content
    assert "page.screenshot" in content
    assert "mobile" in content
    assert "tablet" in content
    assert "desktop" in content
    assert "document.documentElement.scrollWidth" in content
    assert "page.locator('main')" in content
    assert "axe.run" in content
    assert "critical" in content
    assert "serious" in content
    assert "page.keyboard.press('Tab')" in content
    assert ":focus-visible" in content


def test_league_tables_are_contained_on_narrow_screens() -> None:
    league_page = LEAGUE_PAGE.read_text(encoding="utf-8")
    styles = STYLES.read_text(encoding="utf-8")

    assert league_page.count('className="responsive-table"') == 2
    assert 'role="region"' in league_page
    assert "tabIndex={0}" in league_page
    assert ".responsive-table" in styles
    assert "overflow-x: auto" in styles
    assert ".responsive-table:focus-visible" in styles
    assert ".nav-item.active small" in styles
    assert "color: #475569" in styles


def test_interaction_script_exercises_team_selection_validation() -> None:
    content = INTERACTION_SCRIPT.read_text(encoding="utf-8")

    assert "/team-selection" in content
    assert "Move Alex Keeper" in content
    assert "Invalid lineup." in content
    assert "Lineup saved and validated." in content
    assert "selectOption('bench')" in content
    assert "selectOption('starter')" in content


def test_interaction_script_exercises_squad_management_journey() -> None:
    content = INTERACTION_SCRIPT.read_text(encoding="utf-8")

    assert "/squad-management" in content
    assert "Search players" in content
    assert "Casey Midfielder added to interests." in content
    assert "Player detail" in content
    assert "Propose sample trade" in content
    assert "/rules#trade-window" in content


def test_interaction_script_exercises_dashboard_and_fdr_at_two_widths() -> None:
    content = INTERACTION_SCRIPT.read_text(encoding="utf-8")

    assert "/dashboard" in content
    assert "Castle FC drill-down" in content
    assert "Casey Midfielder" in content
    assert "/fdr" in content
    assert "team-river" in content
    assert "Attack FDR table" in content
    assert "mobile" in content
    assert "desktop" in content
    assert "width: 390" in content
    assert "width: 1440" in content
