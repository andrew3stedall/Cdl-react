from pathlib import Path

PREP = Path("docs/runbooks/m78-readiness-prep.md")
SMOKE = Path("docs/runbooks/staging-smoke-checks.md")
GO_LIVE = Path("docs/runbooks/production-go-live-checklist.md")


def test_m78_prep_keeps_manual_gate_visible() -> None:
    content = PREP.read_text(encoding="utf-8")

    assert "Manual platform bootstrap has not been completed" in content
    assert "does not create live resources" in content
    assert "does not mark #70, #71, or #78 complete" in content


def test_staging_smoke_checks_cover_health_and_feature_routes() -> None:
    content = SMOKE.read_text(encoding="utf-8")

    assert "/health" in content
    assert "/api/contracts/theme-presets" in content
    assert "login, squad, team selection, league, dashboard, and FDR" in content
    assert "blocks production go-live" in content


def test_production_go_live_checklist_blocks_real_users() -> None:
    content = GO_LIVE.read_text(encoding="utf-8")

    assert "Production must remain blocked" in content
    assert "Restore drill" in content
    assert "Rollback" in content
    assert "Do not add real users" in content
