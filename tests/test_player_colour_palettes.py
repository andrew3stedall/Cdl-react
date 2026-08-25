from fastapi.testclient import TestClient

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.player_colour_palettes import InMemoryPlayerColourPaletteRepository
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.preferences import get_player_colour_palette_service
from cdl_api.services.player_colour_palettes import PlayerColourPaletteService


def _user(user_id: str) -> SessionUser:
    return SessionUser(
        id=user_id,
        email=f"{user_id}@example.com",
        display_name=user_id,
        roles=["manager"],
    )


def test_player_colour_palettes_are_owned_and_family_sizes_are_validated() -> None:
    repository = InMemoryPlayerColourPaletteRepository()
    app = create_app()
    app.dependency_overrides[get_player_colour_palette_service] = lambda: (
        PlayerColourPaletteService(repository)
    )
    app.dependency_overrides[require_authenticated_session] = lambda: _user("manager-1")
    client = TestClient(app)

    assert client.get("/api/me/preferences/player-palettes").json() == []
    invalid = client.post(
        "/api/me/preferences/player-palettes",
        json={"name": "Too short", "family": "position", "colours": ["#111111", "#222222"]},
    )
    assert invalid.status_code == 422

    created = client.post(
        "/api/me/preferences/player-palettes",
        json={
            "name": "Club positions",
            "family": "position",
            "colours": ["#111111", "#222222", "#333333", "#444444"],
        },
    )
    assert created.status_code == 201
    palette = created.json()
    assert palette["family"] == "position"
    assert palette["colours"] == ["#111111", "#222222", "#333333", "#444444"]
    palette_id = palette["id"]

    app.dependency_overrides[require_authenticated_session] = lambda: _user("manager-2")
    assert client.get("/api/me/preferences/player-palettes").json() == []
    assert client.delete(f"/api/me/preferences/player-palettes/{palette_id}").status_code == 404

    app.dependency_overrides[require_authenticated_session] = lambda: _user("manager-1")
    created_metric = client.post(
        "/api/me/preferences/player-palettes",
        json={
            "name": "Heatmap",
            "family": "metric",
            "colours": ["#111111", "#222222", "#333333", "#444444", "#555555"],
        },
    )
    assert created_metric.status_code == 201
    assert client.delete(f"/api/me/preferences/player-palettes/{palette_id}").status_code == 204
    assert [
        palette["name"] for palette in client.get("/api/me/preferences/player-palettes").json()
    ] == ["Heatmap"]
