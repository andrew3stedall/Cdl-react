from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_checkpoint_five_lists_expected_features() -> None:
    client = TestClient(create_app())

    response = client.get("/api/modernisation/checkpoint-5")

    assert response.status_code == 200
    payload = response.json()
    assert payload["checkpoint"] == 5
    assert {feature["issue"] for feature in payload["features"]} == {47, 48, 49}


def test_migration_dry_run_reports_counts_and_review_items() -> None:
    client = TestClient(create_app())

    response = client.get("/api/modernisation/migration/dry-run?mode=strict")

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "strict"
    assert payload["counts"]["importable_records"] > 0
    assert payload["counts"]["archived_reference_records"] > 0
    assert payload["review_items"]
    assert payload["unguessed_historical_data"] is True


def test_archive_reference_remains_viewable_with_limitations() -> None:
    client = TestClient(create_app())

    response = client.get("/api/modernisation/migration/archive")

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "archive_reference"
    assert payload["records_viewable"] is True
    assert {table["name"] for table in payload["tables"]} >= {
        "legacy_fixture_results",
        "legacy_draft_events",
    }
    assert payload["limitations"]


def test_domain_test_strategy_and_parity_matrix_contracts() -> None:
    client = TestClient(create_app())

    strategy = client.get("/api/modernisation/test-strategy")
    matrix = client.get("/api/modernisation/parity-matrix")

    assert strategy.status_code == 200
    strategy_payload = strategy.json()
    assert {"unit", "service", "scenario", "migration", "legacy_parity"}.issubset(
        strategy_payload["test_layers"]
    )
    assert strategy_payload["fixed_clock_supported"] is True
    assert strategy_payload["legacy_gaps_explicit"] is True
    assert matrix.status_code == 200
    matrix_payload = matrix.json()
    covered_domains = {item["domain"] for item in matrix_payload["coverage"]}
    assert {"draft", "free_agency", "transfers", "loans", "lineups", "chips", "scoring", "tables", "knockouts"}.issubset(
        covered_domains
    )
    assert all(item["scenario_tests"] for item in matrix_payload["coverage"])


def test_roadmap_tracks_dependency_order_and_incomplete_state_guards() -> None:
    client = TestClient(create_app())

    response = client.get("/api/modernisation/roadmap")

    assert response.status_code == 200
    payload = response.json()
    assert payload["order_basis"] == "domain_dependency_order"
    assert payload["guard_incomplete_states"] is True
    checkpoints = payload["checkpoints"]
    assert [checkpoint["checkpoint"] for checkpoint in checkpoints] == [1, 2, 3, 4, 5]
    assert checkpoints[-1]["status"] == "implemented"
    assert payload["sequencing_risks"]
