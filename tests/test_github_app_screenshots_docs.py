from pathlib import Path

RUNBOOK = Path("docs/runbooks/github-app-screenshots.md")
WORKFLOW = Path(".github/workflows/app-screenshots.yml")
SCRIPT = Path("scripts/capture-app-screenshots.mjs")
INTERACTION_SCRIPT = Path("scripts/test-app-interactions.mjs")
LEAGUE_PAGE = Path("frontend/src/LeaguePage.tsx")
STYLES = Path("frontend/src/styles.css")
APP = Path("frontend/src/App.tsx")
LOGIN_PAGE = Path("frontend/src/LoginPage.tsx")
MAIN = Path("frontend/src/main.tsx")
TEAM_SELECTION_API = Path("frontend/src/team-selection-api.ts")
TEAM_SELECTION_PAGE = Path("frontend/src/TeamSelectionPage.tsx")
AUTH = Path("frontend/src/auth.ts")


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
    routes = [
        "/",
        "/login",
        "/league",
        "/dashboard",
        "/fdr",
        "/scouting",
        "/squad-management",
        "/team-selection",
    ]
    for route in routes:
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
    assert "page.reload" in content
    assert "Move Ben Defender" in content
    assert "Move Riley Forward" in content
    assert "Deactivate" in content


def test_interaction_script_exercises_squad_management_journey() -> None:
    content = INTERACTION_SCRIPT.read_text(encoding="utf-8")
    assert "/scouting" in content
    assert "Discovery" in content
    assert "Search players" in content
    assert "Casey Midfielder added to interests." in content
    assert "getByRole('dialog', { name: 'Casey Midfielder' })" in content
    assert "Interests" in content
    assert "Trades" in content
    assert "No proposed trades" in content


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


def test_interaction_script_exercises_shell_navigation_and_history() -> None:
    content = INTERACTION_SCRIPT.read_text(encoding="utf-8")
    assert "/rules" in content
    assert "Primary navigation" in content
    assert "League navigation" in content
    assert "Account menu for Browser Manager" in content
    assert "expectPath(page, '/dashboard')" in content
    assert "aria-expanded" in content
    assert "expectPath(page, '/league/fixtures')" in content
    assert "expectPath(page, '/league/table')" in content
    assert "expectPath(page, '/league/knockout')" in content
    assert "expectPath(page, '/league/head-to-head')" in content


def test_browser_journey_exercises_protected_session_boundary() -> None:
    interactions = INTERACTION_SCRIPT.read_text(encoding="utf-8")
    screenshots = SCRIPT.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")
    login_page = LOGIN_PAGE.read_text(encoding="utf-8")
    main = MAIN.read_text(encoding="utf-8")
    auth = AUTH.read_text(encoding="utf-8")
    assert "/api/auth/session" in interactions
    assert "/api/auth/session" in screenshots
    assert "screenshotSession" in screenshots
    assert "authenticated: false" in interactions
    assert "Welcome back" in interactions
    assert "await expectPath(page, '/login')" in interactions
    assert "expireSession" in interactions
    assert "/api/auth/logout" in interactions
    assert "is_authenticated" in auth
    assert "display_name" in auth
    assert "mapSession" in auth
    assert "getSession()" in app
    assert "demo-manager" not in app
    assert "Checking your session" in app
    assert "VITE_STATIC_PREVIEW" in main
    assert "./login-page.css" in main
    assert "session: staticPreviewSession" in main
    assert "/api/auth/login" in interactions
    assert "Email address" in login_page
    assert "current-password" in login_page
    assert "Invalid email or password." in interactions
    assert "browser-login-secret" in interactions
    assert "testLoginAndLogout(page, api, viewportName)" in interactions


def test_team_selection_consumes_api_lock_state() -> None:
    interactions = INTERACTION_SCRIPT.read_text(encoding="utf-8")
    api_client = TEAM_SELECTION_API.read_text(encoding="utf-8")
    page = TEAM_SELECTION_PAGE.read_text(encoding="utf-8")
    assert "/api/team-selection" in interactions
    assert "/api/team-selection/fixtures-summary" in interactions
    assert "Harbour Athletic vs Mountain United" in interactions
    assert "Castle FC vs Rival Town" not in page
    assert "teamSelectionLocked" in interactions
    assert "Team selection is locked for this gameweek." in interactions
    assert "testLockedTeamSelection(page)" in interactions
    assert "fixtureLock" in api_client
    assert "HttpTeamSelectionClient" in api_client
    assert "fixtureLock.locked" in page
    assert "Save lineup" in page
