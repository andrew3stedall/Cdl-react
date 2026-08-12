"""PostgreSQL-backed user preference repository."""

from collections.abc import Callable

from sqlalchemy import Boolean, Column, MetaData, String, Table, select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.orm import Session

from cdl_api.contracts.theme import UserPreferences

metadata = MetaData()

user_preferences_table = Table(
    "user_preferences",
    metadata,
    Column("user_id", String(64), primary_key=True),
    Column("theme_preset", String(64), nullable=False),
    Column("attack_direction", String(16), nullable=False),
    Column("fdr_scale", String(64), nullable=False),
    Column("fdr_scale_reversed", Boolean, nullable=False),
)


class PostgreSQLUserPreferenceRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_for_user(self, user_id: str) -> UserPreferences:
        with self._session_factory() as session:
            preference_row = session.execute(
                select(
                    user_preferences_table.c.theme_preset,
                    user_preferences_table.c.attack_direction,
                    user_preferences_table.c.fdr_scale,
                    user_preferences_table.c.fdr_scale_reversed,
                ).where(user_preferences_table.c.user_id == user_id)
            ).one_or_none()

        if preference_row is None:
            return UserPreferences()

        return UserPreferences(
            theme_preset=preference_row.theme_preset,
            attack_direction=preference_row.attack_direction,
            fdr_scale=preference_row.fdr_scale,
            fdr_scale_reversed=preference_row.fdr_scale_reversed,
        )

    def save_for_user(self, user_id: str, preferences: UserPreferences) -> UserPreferences:
        statement = postgres_insert(user_preferences_table).values(
            user_id=user_id,
            theme_preset=preferences.theme_preset,
            attack_direction=preferences.attack_direction,
            fdr_scale=preferences.fdr_scale,
            fdr_scale_reversed=preferences.fdr_scale_reversed,
        )
        statement = statement.on_conflict_do_update(
            index_elements=[user_preferences_table.c.user_id],
            set_={
                "theme_preset": preferences.theme_preset,
                "attack_direction": preferences.attack_direction,
                "fdr_scale": preferences.fdr_scale,
                "fdr_scale_reversed": preferences.fdr_scale_reversed,
            },
        )

        with self._session_factory() as session:
            session.execute(statement)
            session.commit()

        return preferences
