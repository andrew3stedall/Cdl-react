from pathlib import Path

APP = Path("src/cdl_api/app.py")
INVENTORY = Path("docs/testing/release-candidate-inventory.md")
TESTER_GUIDE = Path("docs/testing/release-candidate-tester-guide.md")
BROWSER_INTERACTIONS = Path("scripts/test-app-interactions.mjs")
SQUAD_BROWSER_INTERACTIONS = Path("scripts/test-squad-management-interactions.mjs")
SQUAD_ROUTER = Path("src/cdl_api/routers/squad.py")
POSTGRES_SQUAD_TEST = Path("tests/test_postgres_squad_interests.py")


def test_inventory_covers_every_mounted_product_router() -> None:
    app = APP.read_text(encoding="utf-8")
    inventory = INVENTORY.read_text(encoding="utf-8")
    mounted_routers = {
        line.split("app.include_router(", maxsplit=1)[1].split(",", maxsplit=1)[0]
        for line in app.splitlines()
        if "app.include_router(" in line
    }
    documented_boundaries = {
        "auth_router",
        "dashboard_router",
        "fdr_router",
        "fpl_data_router",
        "preferences_router",
        "rules_router",
        "league_router",
        "modernisation_router",
        "modernisation_weekly_router",
        "movement_router",
        "competition_router",
        "history_router",
        "squad_router",
        "team_selection_router",
        "workspace_router",
    }
    assert mounted_routers == documented_boundaries
    for router in documented_boundaries:
        assert f"`{router}`" in inventory


def test_inventory_distinguishes_evidence_from_external_gates() -> None:
    inventory = INVENTORY.read_text(encoding="utf-8")
    required_phrases = (
        "Proven",
        "Partial",
        "Preview only",
        "Externally blocked",
        "Real historical-export compatibility",
        "separate staging task",
        "must not be inferred from synthetic CI evidence",
        "No primary route silently falls back",
    )
    for phrase in required_phrases:
        assert phrase in inventory


def test_inventory_records_reproducible_validation_commands() -> None:
    inventory = INVENTORY.read_text(encoding="utf-8")
    for command in (
        "uv sync",
        "uv run ruff check .",
        "uv run ruff format --check .",
        "uv run pytest",
        "npm run lint",
        "npm run test",
        "npm run build",
        "uv run alembic upgrade head",
    ):
        assert command in inventory
    for workflow in ("CI", "Backend PostgreSQL", "App Screenshots"):
        assert f"`{workflow}`" in inventory


def test_tester_guide_is_deterministic_and_truthful() -> None:
    guide = TESTER_GUIDE.read_text(encoding="utf-8")
    for evidence in (
        "manager@example.com",
        "browser-login-secret",
        "Castle FC",
        "Casey Midfielder",
        "Invalid email or password.",
        "Interest already exists.",
        "Trade proposal created.",
        "formation-valid candidates",
        "latest-four-fixture review drawer",
        "deterministic API test doubles",
        "Live browser-to-PostgreSQL",
        "Real historical exports are unavailable",
        "Commit SHA and workflow run",
        "Do not include secrets",
    ):
        assert evidence in guide


def test_team_selection_release_evidence_is_focused_and_truthful() -> None:
    inventory = INVENTORY.read_text(encoding="utf-8")
    browser = BROWSER_INTERACTIONS.read_text(encoding="utf-8")
    required_browser_evidence = (
        'tr[role="button"][aria-label="View Alex Keeper details"]',
        "Sub",
        "Riley Forward",
        "Confirm sub",
        "Alex Keeper swapped with Riley Forward.",
        "Expected the saved lineup to render clickable player rows after reload",
        "Expected list view to remain free of player movement dropdowns after reload",
        "Triple Captain chip state updated.",
        "Expected Save lineup to be disabled after fixture lock",
        "Expected chip controls to be disabled after fixture lock",
        "Expected substitution to be disabled after fixture lock",
        "runViewport({ width: 390, height: 844 }, 'mobile')",
        "runViewport({ width: 1440, height: 900 }, 'desktop')",
    )
    for evidence in required_browser_evidence:
        assert evidence in browser
    required_inventory_claims = (
        "formation-aware swaps from Starting XI/Bench/Reserves",
        "the review drawer presents both players and confirm/cancel actions",
        "lineup/chip/profile substitution controls are disabled when a fixture lock is active",
        "Live PostgreSQL browser integration and staging identity remain separate gates",
    )
    for claim in required_inventory_claims:
        assert claim in inventory


def test_authenticated_squad_and_market_evidence_is_focused_and_truthful() -> None:
    inventory = INVENTORY.read_text(encoding="utf-8")
    browser = SQUAD_BROWSER_INTERACTIONS.read_text(encoding="utf-8")
    router = SQUAD_ROUTER.read_text(encoding="utf-8")
    postgres_test = POSTGRES_SQUAD_TEST.read_text(encoding="utf-8")

    required_browser_evidence = (
        "squad-page__drawer--profile",
        "Squad-management actions",
        "Compare player",
        "Remove player",
        "squad-reference-remove-action",
        "Casey Midfielder added to Interests.",
        "page.reload({ waitUntil: 'networkidle' })",
        "{ width: 390, height: 844 }",
        "{ width: 1440, height: 900 }",
    )
    for evidence in required_browser_evidence:
        assert evidence in browser

    for evidence in (
        "Depends(require_manager_session)",
        '@router.get("/interests"',
        '@router.post("/interests"',
        '@router.get("/trades"',
        '@router.post("/trades"',
        '@router.put("/trades/{trade_id}"',
    ):
        assert evidence in router

    for evidence in (
        "PostgreSQLSquadRepository",
        "Interest already exists.",
        "Invalid trade asset.",
        "Trade transition is not authorized.",
        "Trade is no longer pending.",
        'assert stored_status == "accepted"',
        "assert count == 1",
        "assert proposal_count == 1",
        "assert asset_count == 2",
    ):
        assert evidence in postgres_test

    required_inventory_claims = (
        "require an authenticated manager",
        "counterparty manager",
        "stale repeated transitions fail without changing the accepted state",
        "browser uses a deterministic API test double",
        "PostgreSQL persistence is proved separately by backend CI",
        "UI does not expose counterparty acceptance/rejection controls",
    )
    for claim in required_inventory_claims:
        assert claim in inventory
