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
    Column("fdr_display_mode", String(16), nullable=False),
    Column("position_colour_scale", String(32), nullable=False),
    Column("position_colour_mode", String(32), nullable=False),
    Column("position_custom_gkp", String(7), nullable=False),
    Column("position_custom_def", String(7), nullable=False),
    Column("position_custom_mid", String(7), nullable=False),
    Column("position_custom_fwd", String(7), nullable=False),
    Column("metric_colour_scale", String(32), nullable=False),
    Column("metric_colour_scale_reversed", Boolean, nullable=False),
    Column("metric_custom_1", String(7), nullable=False),
    Column("metric_custom_2", String(7), nullable=False),
    Column("metric_custom_3", String(7), nullable=False),
    Column("metric_custom_4", String(7), nullable=False),
    Column("metric_custom_5", String(7), nullable=False),
    Column("light_theme_colour", String(7), nullable=False),
    Column("dark_theme_colour", String(7), nullable=False),
    Column("fdr_custom_min", String(7), nullable=False),
    Column("fdr_custom_second", String(7), nullable=False),
    Column("fdr_custom_mid", String(7), nullable=False),
    Column("fdr_custom_fourth", String(7), nullable=False),
    Column("fdr_custom_max", String(7), nullable=False),
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
                    user_preferences_table.c.fdr_display_mode,
                    user_preferences_table.c.position_colour_scale,
                    user_preferences_table.c.position_colour_mode,
                    user_preferences_table.c.position_custom_gkp,
                    user_preferences_table.c.position_custom_def,
                    user_preferences_table.c.position_custom_mid,
                    user_preferences_table.c.position_custom_fwd,
                    user_preferences_table.c.metric_colour_scale,
                    user_preferences_table.c.metric_colour_scale_reversed,
                    user_preferences_table.c.metric_custom_1,
                    user_preferences_table.c.metric_custom_2,
                    user_preferences_table.c.metric_custom_3,
                    user_preferences_table.c.metric_custom_4,
                    user_preferences_table.c.metric_custom_5,
                    user_preferences_table.c.light_theme_colour,
                    user_preferences_table.c.dark_theme_colour,
                    user_preferences_table.c.fdr_custom_min,
                    user_preferences_table.c.fdr_custom_second,
                    user_preferences_table.c.fdr_custom_mid,
                    user_preferences_table.c.fdr_custom_fourth,
                    user_preferences_table.c.fdr_custom_max,
                ).where(user_preferences_table.c.user_id == user_id)
            ).one_or_none()

        if preference_row is None:
            return UserPreferences()

        return UserPreferences(
            theme_preset=preference_row.theme_preset,
            attack_direction=preference_row.attack_direction,
            fdr_scale=preference_row.fdr_scale,
            fdr_scale_reversed=preference_row.fdr_scale_reversed,
            fdr_display_mode=preference_row.fdr_display_mode,
            position_colour_scale=preference_row.position_colour_scale,
            position_colour_mode=preference_row.position_colour_mode,
            position_custom_gkp=preference_row.position_custom_gkp,
            position_custom_def=preference_row.position_custom_def,
            position_custom_mid=preference_row.position_custom_mid,
            position_custom_fwd=preference_row.position_custom_fwd,
            metric_colour_scale=preference_row.metric_colour_scale,
            metric_colour_scale_reversed=preference_row.metric_colour_scale_reversed,
            metric_custom_1=preference_row.metric_custom_1,
            metric_custom_2=preference_row.metric_custom_2,
            metric_custom_3=preference_row.metric_custom_3,
            metric_custom_4=preference_row.metric_custom_4,
            metric_custom_5=preference_row.metric_custom_5,
            light_theme_colour=preference_row.light_theme_colour,
            dark_theme_colour=preference_row.dark_theme_colour,
            fdr_custom_min=preference_row.fdr_custom_min,
            fdr_custom_second=preference_row.fdr_custom_second,
            fdr_custom_mid=preference_row.fdr_custom_mid,
            fdr_custom_fourth=preference_row.fdr_custom_fourth,
            fdr_custom_max=preference_row.fdr_custom_max,
        )

    def save_for_user(self, user_id: str, preferences: UserPreferences) -> UserPreferences:
        statement = postgres_insert(user_preferences_table).values(
            user_id=user_id,
            theme_preset=preferences.theme_preset,
            attack_direction=preferences.attack_direction,
            fdr_scale=preferences.fdr_scale,
            fdr_scale_reversed=preferences.fdr_scale_reversed,
            fdr_display_mode=preferences.fdr_display_mode,
            position_colour_scale=preferences.position_colour_scale,
            position_colour_mode=preferences.position_colour_mode,
            position_custom_gkp=preferences.position_custom_gkp,
            position_custom_def=preferences.position_custom_def,
            position_custom_mid=preferences.position_custom_mid,
            position_custom_fwd=preferences.position_custom_fwd,
            metric_colour_scale=preferences.metric_colour_scale,
            metric_colour_scale_reversed=preferences.metric_colour_scale_reversed,
            metric_custom_1=preferences.metric_custom_1,
            metric_custom_2=preferences.metric_custom_2,
            metric_custom_3=preferences.metric_custom_3,
            metric_custom_4=preferences.metric_custom_4,
            metric_custom_5=preferences.metric_custom_5,
            light_theme_colour=preferences.light_theme_colour,
            dark_theme_colour=preferences.dark_theme_colour,
            fdr_custom_min=preferences.fdr_custom_min,
            fdr_custom_second=preferences.fdr_custom_second,
            fdr_custom_mid=preferences.fdr_custom_mid,
            fdr_custom_fourth=preferences.fdr_custom_fourth,
            fdr_custom_max=preferences.fdr_custom_max,
        )
        statement = statement.on_conflict_do_update(
            index_elements=[user_preferences_table.c.user_id],
            set_={
                "theme_preset": preferences.theme_preset,
                "attack_direction": preferences.attack_direction,
                "fdr_scale": preferences.fdr_scale,
                "fdr_scale_reversed": preferences.fdr_scale_reversed,
                "fdr_display_mode": preferences.fdr_display_mode,
                "position_colour_scale": preferences.position_colour_scale,
                "position_colour_mode": preferences.position_colour_mode,
                "position_custom_gkp": preferences.position_custom_gkp,
                "position_custom_def": preferences.position_custom_def,
                "position_custom_mid": preferences.position_custom_mid,
                "position_custom_fwd": preferences.position_custom_fwd,
                "metric_colour_scale": preferences.metric_colour_scale,
                "metric_colour_scale_reversed": preferences.metric_colour_scale_reversed,
                "metric_custom_1": preferences.metric_custom_1,
                "metric_custom_2": preferences.metric_custom_2,
                "metric_custom_3": preferences.metric_custom_3,
                "metric_custom_4": preferences.metric_custom_4,
                "metric_custom_5": preferences.metric_custom_5,
                "light_theme_colour": preferences.light_theme_colour,
                "dark_theme_colour": preferences.dark_theme_colour,
                "fdr_custom_min": preferences.fdr_custom_min,
                "fdr_custom_second": preferences.fdr_custom_second,
                "fdr_custom_mid": preferences.fdr_custom_mid,
                "fdr_custom_fourth": preferences.fdr_custom_fourth,
                "fdr_custom_max": preferences.fdr_custom_max,
            },
        )

        with self._session_factory() as session:
            session.execute(statement)
            session.commit()

        return preferences
