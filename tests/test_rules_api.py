from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_rules_index_endpoint_returns_sections() -> None:
    client = TestClient(create_app())

    response = client.get("/api/rules")

    assert response.status_code == 200
    payload = response.json()
    assert payload["version"]["version"] == "2026.05"
    assert any(section["id"] == "squad-size" for section in payload["sections"])


def test_rules_category_filter_limits_sections() -> None:
    client = TestClient(create_app())

    response = client.get("/api/rules?category=trades")

    assert response.status_code == 200
    sections = response.json()["sections"]
    assert sections
    assert {section["category"] for section in sections} == {"trades"}


def test_rules_search_finds_body_and_tags() -> None:
    client = TestClient(create_app())

    response = client.get("/api/rules/search?q=deadline")

    assert response.status_code == 200
    ids = {section["id"] for section in response.json()["sections"]}
    assert "transfer-deadline" in ids


def test_rule_detail_endpoint_supports_deep_links() -> None:
    client = TestClient(create_app())

    response = client.get("/api/rules/squad-size")

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == "squad-size"
    assert "squad-size" in payload["anchors"]
