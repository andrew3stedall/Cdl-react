from pathlib import Path

RUNBOOK = Path("docs/runbooks/github-app-screenshots.md")
WORKFLOW = Path(".github/workflows/app-screenshots.yml")
SCRIPT = Path("scripts/capture-app-screenshots.mjs")


def test_screenshot_runbook_explains_github_artifacts() -> None:
    content = RUNBOOK.read_text(encoding="utf-8")

    assert "App Screenshots" in content
    assert "app-screenshots" in content
    assert "does not require GCP" in content
    assert "/team-selection" in content


def test_screenshot_workflow_uploads_artifact_without_deploying() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    assert "actions/upload-artifact" in content
    assert "Capture screenshots" in content
    assert "deployment" not in content.lower()


def test_screenshot_script_captures_core_routes() -> None:
    content = SCRIPT.read_text(encoding="utf-8")

    for route in ["/", "/league", "/dashboard", "/fdr", "/squad-management", "/team-selection"]:
        assert route in content

    assert "chromium.launch" in content
    assert "page.screenshot" in content
