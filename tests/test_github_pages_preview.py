from pathlib import Path

RUNBOOK = Path("docs/runbooks/github-pages-static-preview.md")
WORKFLOW = Path(".github/workflows/github-pages.yml")
VITE_CONFIG = Path("frontend/vite.config.ts")
MAIN = Path("frontend/src/main.tsx")
STATIC_CLIENTS = Path("frontend/src/static-preview-clients.ts")


def test_pages_workflow_is_manual_and_static_preview_only() -> None:
    content = WORKFLOW.read_text(encoding="utf-8")

    assert "workflow_dispatch" in content
    assert "VITE_STATIC_PREVIEW" in content
    assert "npm run build -- --mode github-pages" in content
    assert "actions/upload-pages-artifact" in content
    assert "actions/deploy-pages" in content


def test_vite_uses_repository_base_for_pages() -> None:
    content = VITE_CONFIG.read_text(encoding="utf-8")

    assert "mode === 'github-pages'" in content
    assert "'/Cdl-react/'" in content


def test_static_preview_clients_are_wired_into_main_entrypoint() -> None:
    content = MAIN.read_text(encoding="utf-8")

    assert "VITE_STATIC_PREVIEW" in content
    assert "staticPreviewDashboardClient" in content
    assert "staticPreviewLeagueClient" in content
    assert "staticPreviewFdrClient" in content
    assert "getInitialPath" in content


def test_static_preview_clients_avoid_api_dependency() -> None:
    content = STATIC_CLIENTS.read_text(encoding="utf-8")

    assert "staticPreviewDashboardClient" in content
    assert "staticPreviewLeagueClient" in content
    assert "staticPreviewFdrClient" in content
    assert "GitHub Pages static preview" in content


def test_pages_runbook_explains_manual_setup_and_public_safety() -> None:
    content = RUNBOOK.read_text(encoding="utf-8")

    assert "Source" in content
    assert "GitHub Actions" in content
    assert "https://andrew3stedall.github.io/Cdl-react/" in content
    assert "This is public" in content
    assert "not production" in content
