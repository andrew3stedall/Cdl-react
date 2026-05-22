from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_current_and_next_fixture_endpoints_return_gameweek_buckets() -> None:
    client = TestClient(create_app())

    current_response = client.get("/api/league/fixtures/current")
    next_response = client.get("/api/league/fixtures/next")

    assert current_response.status_code == 200
    assert next_response.status_code == 200
    assert current_response.json()["gameweek"]["number"] == 12
    assert next_response.json()["gameweek"]["number"] == 13


def test_all_fixtures_and_fixture_detail_endpoints() -> None:
    client = TestClient(create_app())

    all_response = client.get("/api/league/fixtures")
    detail_response = client.get("/api/league/fixtures/fixture-1201")
    unavailable_response = client.get("/api/league/fixtures/fixture-1202")

    assert all_response.status_code == 200
    assert len(all_response.json()["fixtures"]) >= 5
    assert detail_response.status_code == 200
    assert detail_response.json()["fixture"]["id"] == "fixture-1201"
    assert unavailable_response.status_code == 404
    assert unavailable_response.json()["code"] == "not_found"


def test_table_knockout_and_head_to_head_endpoints() -> None:
    client = TestClient(create_app())

    table_response = client.get("/api/league/table")
    knockout_response = client.get("/api/league/knockout")
    head_to_head_response = client.get("/api/league/head-to-head")

    assert table_response.status_code == 200
    assert table_response.json()["rows"][0]["team"]["id"] == "castle"
    assert knockout_response.status_code == 200
    assert knockout_response.json()["matches"][0]["round_label"] == "Semi Final"
    assert head_to_head_response.status_code == 200
    assert head_to_head_response.json()["records"][0]["opponent"]["id"] == "drafton"
