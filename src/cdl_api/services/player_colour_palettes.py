"""Validation and ownership rules for player colour palettes."""

from uuid import uuid4

from cdl_api.contracts.theme import PlayerColourPalette, PlayerColourPaletteCreate


class PlayerColourPaletteService:
    def __init__(self, repository: object) -> None:
        self._repository = repository

    def list_palettes(self, user_id: str) -> list[PlayerColourPalette]:
        return self._repository.list_for_user(user_id)

    def create_palette(
        self, user_id: str, payload: PlayerColourPaletteCreate
    ) -> PlayerColourPalette:
        name = payload.name.strip()
        expected_count = 4 if payload.family == "position" else 5
        if not name:
            raise ValueError("Palette name cannot be blank.")
        if len(payload.colours) != expected_count or any(
            not isinstance(colour, str) or not _is_hex_colour(colour) for colour in payload.colours
        ):
            raise ValueError(
                f"{payload.family.title()} palettes require {expected_count} valid colours."
            )
        palette = PlayerColourPalette(
            id=f"player-{uuid4().hex}",
            name=name,
            family=payload.family,
            colours=[colour.upper() for colour in payload.colours],
        )
        return self._repository.create_for_user(user_id, palette)

    def delete_palette(self, user_id: str, palette_id: str) -> bool:
        return self._repository.delete_for_user(user_id, palette_id)


def _is_hex_colour(value: str) -> bool:
    return (
        len(value) == 7
        and value.startswith("#")
        and all(character in "0123456789abcdefABCDEF" for character in value[1:])
    )
