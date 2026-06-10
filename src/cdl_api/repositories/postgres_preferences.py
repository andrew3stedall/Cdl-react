"""PostgreSQL-backed user preference repository."""

from collections.abc import Callable

from sqlalchemy import Column, MetaData, String, Table, insert, select
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.orm import Session

from cdl_api.contracts.theme import UserPreferences

metadata = MetaData()

user_preferences_table = Table(
    "user_preferences",
    metadata,
    Column("user_id", String(64), primary_key=True),
    Column("theme_preset", String(64), nullable=False),
)


class PostgreSQLUserPreferenceRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_for_user(self, user_id: str) -> UserPreferences:
        with self._session_factory() as session:
            theme_preset = session.execute(
                select(user_preferences_table.c.theme_preset).where(
                    user_preferences_table.c.user_id == user_id
                )
            ).scalar_one_or_none()

        if theme_preset is None:
            return UserPreferences()

        return UserPreferences(theme_preset=theme_preset)

    def save_for_user(self, user_id: str, preferences: UserPreferences) -> UserPreferences:
        statement = postgres_insert(user_preferences_table).values(
            user_id=user_id,
            theme_preset=preferences.theme_preset,
        )
        statement = statement.on_conflict_do_update(
            index_elements=[user_preferences_table.c.user_id],
            set_={"theme_preset": preferences.theme_preset},
        )

        with self._session_factory() as session:
            session.execute(statement)
            session.commit()

        return preferences
