from pathlib import Path


def test_manual_screenshot_harness_matches_current_release_contract() -> None:
    source = Path("scripts/capture-app-screenshots.mjs").read_text(encoding="utf-8")

    assert "mobile-landscape" in source
    assert "const themePresets = ['teal-light', 'teal-dark', 'adaptive'];" in source
    assert "player-20" in source
    assert "Wildcard" not in source
    for chip in ["Triple Captain", "Dual Captain", "Auto Captain", "Bench Boost", "Best XI"]:
        assert chip in source
    assert "league-manage" in source
    assert "window.axe.run" in source


def test_screenshot_workflow_remains_manual_only() -> None:
    workflow = Path(".github/workflows/app-screenshots.yml").read_text(encoding="utf-8")

    assert "workflow_dispatch:" in workflow
    assert "pull_request:" not in workflow
    assert "\npush:" not in workflow
