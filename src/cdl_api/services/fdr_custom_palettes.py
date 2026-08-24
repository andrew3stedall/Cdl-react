"""Validation and ownership rules for saved FDR custom palettes."""

from uuid import uuid4

from cdl_api.contracts.theme import FdrCustomPalette, FdrCustomPaletteCreate


class FdrCustomPaletteService:
    def __init__(self, repository: object) -> None:
        self._repository = repository

    def list_palettes(self, user_id: str) -> list[FdrCustomPalette]:
        return self._repository.list_for_user(user_id)

    def create_palette(self, user_id: str, payload: FdrCustomPaletteCreate) -> FdrCustomPalette:
        name = payload.name.strip()
        if not name:
            raise ValueError("Palette name cannot be blank.")
        palette = FdrCustomPalette(
            id=f"fdr-{uuid4().hex}",
            name=name,
            mode=payload.mode,
            min=payload.min.upper(),
            second=payload.second.upper(),
            mid=payload.mid.upper(),
            fourth=payload.fourth.upper(),
            max=payload.max.upper(),
        )
        return self._repository.create_for_user(user_id, palette)

    def delete_palette(self, user_id: str, palette_id: str) -> bool:
        return self._repository.delete_for_user(user_id, palette_id)
