from fastapi.testclient import TestClient

from cdl_api.app import create_app


def test_combined_fdr_endpoint_returns_attack_defence_and_scales() -> None:
    client = TestClient(create_app())

    response = client.get("/api/fdr")

    assert response.status_code == 200
    body = response.json()
    assert body["attack"]["view"] == "attack"
    assert body["defence"]["view"] == "defence"
    assert len(body["scales"]) == 5


def test_attack_and_defence_fdr_endpoints_support_filters() -> None:
    client = TestClient(create_app())

    attack_response = client.get(
        "/api/fdr/attack",
        params={"team_id": "arsenal", "gameweek_start": 13, "gameweek_end": 14},
    )
    defence_response = client.get(
        "/api/fdr/defence",
        params={"team_id": "man-city", "gameweek_start": 12, "gameweek_end": 12},
    )

    assert attack_response.status_code == 200
    assert defence_response.status_code == 200
    attack_body = attack_response.json()
    defence_body = defence_response.json()
    gameweek_numbers = [
        fixture["gameweek"]["number"] for fixture in attack_body["rows"][0]["fixtures"]
    ]
    assert attack_body["rows"][0]["team"]["id"] == "arsenal"
    assert gameweek_numbers == [13, 14]
    assert defence_body["rows"][0]["team"]["id"] == "man-city"


def test_fdr_scales_endpoint_returns_accessible_theme_tokens() -> None:
    client = TestClient(create_app())

    response = client.get("/api/fdr/scales")

    assert response.status_code == 200
    first_scale = response.json()[0]
    assert first_scale["background_token"].startswith("fdr-")
    assert first_scale["background_token"].endswith("-background")
    assert first_scale["contrast_ratio"] >= 4.5
