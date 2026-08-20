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
SQUAD_PAGE = Path("frontend/src/SquadPage.tsx")
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
        "/squad-management",
        "/scouting",
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
    assert league_page.count('className="league-table-scroll"') == 1
    assert 'role="region"' in league_page
    assert "tabIndex={0}" in league_page
    assert ".responsive-table" in styles
    assert "overflow-x: auto" in styles
    assert ".responsive-table:focus-visible" in styles
    assert ".nav-item small" in styles
    assert "color: var(--muted-foreground)" in styles


def test_interaction_script_exercises_team_selection_validation() -> None:
    content = INTERACTION_SCRIPT.read_text(encoding="utf-8")
    assert "/team-selection" in content
    assert "Player actions for Alex Keeper" in content
    assert "Move to bench" in content
    assert "Riley Forward" in content
    assert "Alex Keeper moved to the bench." in content
    assert "Confirm move" in content
    assert "List view must not expose player movement dropdowns" in content
    assert "page.reload" in content
    assert "Triple Captain, active" in content


def test_interaction_script_exercises_squad_management_journey() -> None:
    content = INTERACTION_SCRIPT.read_text(encoding="utf-8")
    assert "/scouting" in content
    assert "Discovery" in content
    assert "Search market players" in content
    assert "Casey Midfielder added to Interests." in content
    assert "Interests" in content
    assert "Trades" in content
    assert "Trade activity" in content


def test_interaction_script_exercises_dashboard_and_fdr_at_two_widths() -> None:
    content = INTERACTION_SCRIPT.read_text(encoding="utf-8")
    assert "/dashboard/analytics" in content
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
    assert "View table" in content
    assert "manager-account-menu" in content
    assert "expectPath(page, '/')" in content
    assert "Gaffers Desk" in content
    assert "Global mobile navigation" in content
    assert "must not expose a redundant top menu button" in content
    assert "View fixtures" in content


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
    page = SQUAD_PAGE.read_text(encoding="utf-8")
    assert "/api/team-selection" in interactions
    assert "Next deadline" in interactions
    assert "Triple Captain, available" in interactions
    assert "teamSelectionLocked" in interactions
    assert "Team selection is locked for this gameweek." in interactions
    assert "testLockedTeamSelection(page)" in interactions
    assert "fixtureLock" in api_client
    assert "HttpTeamSelectionClient" in api_client
    assert "fixtureLock.locked" in page
    assert "Save lineup" in page
    assert "squad-page__chip-toggle" in page
