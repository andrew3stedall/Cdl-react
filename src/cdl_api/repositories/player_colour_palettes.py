"""Repositories for manager-owned player position and metric palettes."""

from collections.abc import Callable

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    MetaData,
    String,
    Table,
    func,
    insert,
    select,
)
from sqlalchemy.orm import Session

from cdl_api.contracts.theme import PlayerColourPalette

metadata = MetaData()

player_colour_palettes_table = Table(
    "player_colour_palettes",
    metadata,
    Column("id", String(64), primary_key=True),
    Column(
        "user_id",
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("name", String(80), nullable=False),
    Column("family", String(16), nullable=False),
    Column("colours", JSON, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)


class InMemoryPlayerColourPaletteRepository:
    """Store player palettes by authenticated manager for memory-mode tests."""

    def __init__(self) -> None:
        self._palettes_by_user_id: dict[str, list[PlayerColourPalette]] = {}

    def list_for_user(self, user_id: str) -> list[PlayerColourPalette]:
        return list(self._palettes_by_user_id.get(user_id, []))

    def create_for_user(self, user_id: str, palette: PlayerColourPalette) -> PlayerColourPalette:
        self._palettes_by_user_id.setdefault(user_id, []).append(palette)
        return palette

    def delete_for_user(self, user_id: str, palette_id: str) -> bool:
        palettes = self._palettes_by_user_id.get(user_id, [])
        remaining = [palette for palette in palettes if palette.id != palette_id]
        deleted = len(remaining) != len(palettes)
        if deleted:
            self._palettes_by_user_id[user_id] = remaining
        return deleted


class PostgreSQLPlayerColourPaletteRepository:
    """Persist player palettes with ownership enforced by every query."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def list_for_user(self, user_id: str) -> list[PlayerColourPalette]:
        with self._session_factory() as session:
            rows = (
                session.execute(
                    select(player_colour_palettes_table)
                    .where(player_colour_palettes_table.c.user_id == user_id)
                    .order_by(
                        player_colour_palettes_table.c.created_at,
                        player_colour_palettes_table.c.id,
                    )
                )
                .mappings()
                .all()
            )
        return [self._to_contract(row) for row in rows]

    def create_for_user(self, user_id: str, palette: PlayerColourPalette) -> PlayerColourPalette:
        with self._session_factory() as session:
            session.execute(
                insert(player_colour_palettes_table).values(
                    id=palette.id,
                    user_id=user_id,
                    name=palette.name,
                    family=palette.family,
                    colours=palette.colours,
                )
            )
            session.commit()
        return palette

    def delete_for_user(self, user_id: str, palette_id: str) -> bool:
        from sqlalchemy import delete

        with self._session_factory() as session:
            result = session.execute(
                delete(player_colour_palettes_table).where(
                    player_colour_palettes_table.c.user_id == user_id,
                    player_colour_palettes_table.c.id == palette_id,
                )
            )
            session.commit()
        return result.rowcount == 1

    @staticmethod
    def _to_contract(row: object) -> PlayerColourPalette:
        return PlayerColourPalette(
            id=row["id"],
            name=row["name"],
            family=row["family"],
            colours=list(row["colours"]),
        )
