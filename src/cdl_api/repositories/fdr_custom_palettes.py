"""Repositories for manager-owned FDR custom palettes."""

from collections.abc import Callable

from sqlalchemy import Column, DateTime, ForeignKey, MetaData, String, Table, func, insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.theme import FdrCustomPalette

metadata = MetaData()

fdr_custom_palettes_table = Table(
    "fdr_custom_palettes",
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
    Column("mode", String(16), nullable=False),
    Column("fdr_custom_min", String(7), nullable=False),
    Column("fdr_custom_second", String(7), nullable=False),
    Column("fdr_custom_mid", String(7), nullable=False),
    Column("fdr_custom_fourth", String(7), nullable=False),
    Column("fdr_custom_max", String(7), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)


class InMemoryFdrCustomPaletteRepository:
    """Store custom palettes by authenticated manager for memory-mode tests."""

    def __init__(self) -> None:
        self._palettes_by_user_id: dict[str, list[FdrCustomPalette]] = {}

    def list_for_user(self, user_id: str) -> list[FdrCustomPalette]:
        return list(self._palettes_by_user_id.get(user_id, []))

    def create_for_user(self, user_id: str, palette: FdrCustomPalette) -> FdrCustomPalette:
        self._palettes_by_user_id.setdefault(user_id, []).append(palette)
        return palette

    def delete_for_user(self, user_id: str, palette_id: str) -> bool:
        palettes = self._palettes_by_user_id.get(user_id, [])
        remaining = [palette for palette in palettes if palette.id != palette_id]
        deleted = len(remaining) != len(palettes)
        if deleted:
            self._palettes_by_user_id[user_id] = remaining
        return deleted


class PostgreSQLFdrCustomPaletteRepository:
    """Persist custom palettes with ownership enforced by every query."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def list_for_user(self, user_id: str) -> list[FdrCustomPalette]:
        with self._session_factory() as session:
            rows = (
                session.execute(
                    select(fdr_custom_palettes_table)
                    .where(fdr_custom_palettes_table.c.user_id == user_id)
                    .order_by(
                        fdr_custom_palettes_table.c.created_at,
                        fdr_custom_palettes_table.c.id,
                    )
                )
                .mappings()
                .all()
            )
        return [self._to_contract(row) for row in rows]

    def create_for_user(self, user_id: str, palette: FdrCustomPalette) -> FdrCustomPalette:
        with self._session_factory() as session:
            session.execute(
                insert(fdr_custom_palettes_table).values(
                    id=palette.id,
                    user_id=user_id,
                    name=palette.name,
                    mode=palette.mode,
                    fdr_custom_min=palette.min,
                    fdr_custom_second=palette.second,
                    fdr_custom_mid=palette.mid,
                    fdr_custom_fourth=palette.fourth,
                    fdr_custom_max=palette.max,
                )
            )
            session.commit()
        return palette

    def delete_for_user(self, user_id: str, palette_id: str) -> bool:
        from sqlalchemy import delete

        with self._session_factory() as session:
            result = session.execute(
                delete(fdr_custom_palettes_table).where(
                    fdr_custom_palettes_table.c.user_id == user_id,
                    fdr_custom_palettes_table.c.id == palette_id,
                )
            )
            session.commit()
        return result.rowcount == 1

    @staticmethod
    def _to_contract(row: object) -> FdrCustomPalette:
        return FdrCustomPalette(
            id=row["id"],
            name=row["name"],
            mode=row["mode"],
            min=row["fdr_custom_min"],
            second=row["fdr_custom_second"],
            mid=row["fdr_custom_mid"],
            fourth=row["fdr_custom_fourth"],
            max=row["fdr_custom_max"],
        )
