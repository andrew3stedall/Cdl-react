from pathlib import Path

INDEX_PATH = Path("docs/features/active/legacy-migration-feature-index.md")
WIKI_PATH = Path("docs/wiki/legacy-migration-feature-index.md")


def read_index() -> str:
    return INDEX_PATH.read_text(encoding="utf-8")


def read_wiki() -> str:
    return WIKI_PATH.read_text(encoding="utf-8")


def test_reviewed_legacy_entry_points_are_tracked() -> None:
    content = read_index()

    for entry_point in [
        "index.php",
        "index.html",
        "myTeam.html",
        "fixtures.html",
        "rules.html",
        "dashboard.html",
        "FDR.html",
        "assets/js/",
    ]:
        assert entry_point in content


def test_all_major_active_feature_documents_are_mapped() -> None:
    content = read_index()

    for feature_document in [
        "authentication-and-session-management.md",
        "application-shell-navigation-and-presets.md",
        "squad-management-scouting-and-transfers.md",
        "team-selection-and-chip-management.md",
        "league-fixtures-and-table.md",
        "rules-knowledge-base.md",
        "analytics-dashboard.md",
        "fixture-difficulty-ratings.md",
        "backend-api-data-platform.md",
    ]:
        assert f"docs/features/active/{feature_document}" in content


def test_dashboard_and_fdr_are_mapped_to_implemented_foundations() -> None:
    content = read_index()

    assert "Not implemented yet" not in content
    assert "`/dashboard`, `/api/dashboard/config`" in content
    assert "`/fdr`, `/api/fdr`, `/api/fdr/attack`" in content
    assert "Sample-backed dashboard and FDR repositories" in content


def test_missing_feature_candidates_are_tracked_with_decision_rules() -> None:
    content = read_index()

    for candidate in [
        "Commissioner-only administration screens or endpoints",
        "Notification, email, or reminder flows",
        "Import/export, backups, or manual data repair tools",
        "Additional visual reports outside `dashboard.html` and `FDR.html`",
    ]:
        assert candidate in content
    assert "Decision rule" in content


def test_migration_risks_are_visible_for_affected_workflows() -> None:
    content = read_index()

    sample_backed_risk = (
        "Sample-backed dashboard and FDR repositories may diverge from production "
        "legacy calculations."
    )
    for risk in [
        "Legacy PHP endpoints may return undocumented shapes.",
        "D3 dashboard/FDR visualisations may encode business logic in JavaScript.",
        "Static rule copy may conflict with runtime validation.",
        "Browser-local state may affect legacy UI flows.",
        "Database views may combine business rules and presentation logic.",
        sample_backed_risk,
    ]:
        assert risk in content


def test_wiki_matches_current_dashboard_and_fdr_status() -> None:
    content = read_wiki()

    assert "Dashboard and FDR are no longer tracked as unimplemented planning gaps" in content
    assert "Implemented foundation" in content
    assert "Sample-backed dashboard and FDR repositories" in content


def test_feature_document_remains_active_until_coverage_is_complete() -> None:
    content = read_index()

    assert "Do not move this feature document to completed" in content
    assert "This document remains active until legacy migration coverage is complete." in content
