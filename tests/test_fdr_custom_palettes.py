from fastapi.testclient import TestClient

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.fdr_custom_palettes import InMemoryFdrCustomPaletteRepository
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.preferences import get_fdr_custom_palette_service
from cdl_api.services.fdr_custom_palettes import FdrCustomPaletteService


def _user(user_id: str) -> SessionUser:
    return SessionUser(
        id=user_id,
        email=f"{user_id}@example.com",
        display_name=user_id,
        roles=["manager"],
    )


def test_custom_palettes_are_owned_saved_and_deletable_without_affecting_stock_scales() -> None:
    repository = InMemoryFdrCustomPaletteRepository()
    app = create_app()
    app.dependency_overrides[get_fdr_custom_palette_service] = lambda: FdrCustomPaletteService(
        repository,
    )
    app.dependency_overrides[require_authenticated_session] = lambda: _user("palette-manager-1")
    client = TestClient(app)

    assert client.get("/api/me/preferences/fdr-palettes").json() == []
    assert client.delete("/api/me/preferences/fdr-palettes/BrBG").status_code == 404
    created = client.post(
        "/api/me/preferences/fdr-palettes",
        json={
            "name": "  Weekend watch  ",
            "mode": "all",
            "min": "#010203",
            "second": "#111213",
            "mid": "#212223",
            "fourth": "#313233",
            "max": "#414243",
        },
    )
    assert created.status_code == 201
    assert created.json() == {
        "id": created.json()["id"],
        "name": "Weekend watch",
        "mode": "all",
        "min": "#010203",
        "second": "#111213",
        "mid": "#212223",
        "fourth": "#313233",
        "max": "#414243",
    }
    palette_id = created.json()["id"]
    assert client.get("/api/me/preferences/fdr-palettes").json()[0]["id"] == palette_id

    app.dependency_overrides[require_authenticated_session] = lambda: _user("palette-manager-2")
    assert client.get("/api/me/preferences/fdr-palettes").json() == []
    assert client.delete(f"/api/me/preferences/fdr-palettes/{palette_id}").status_code == 404

    app.dependency_overrides[require_authenticated_session] = lambda: _user("palette-manager-1")
    assert client.delete(f"/api/me/preferences/fdr-palettes/{palette_id}").status_code == 204
    assert client.get("/api/me/preferences/fdr-palettes").json() == []
