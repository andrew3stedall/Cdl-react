from pathlib import Path

APP = Path("src/cdl_api/app.py")
INVENTORY = Path("docs/testing/release-candidate-inventory.md")


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
