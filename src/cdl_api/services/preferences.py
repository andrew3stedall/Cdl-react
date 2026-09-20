"""User preference service."""

import re

from cdl_api.contracts.theme import ThemeAccentColours, ThemeColourVariants, UserPreferences
from cdl_api.repositories.preferences import InMemoryUserPreferenceRepository

SUPPORTED_THEME_PRESETS = {
    "classic",
    "dark",
    "compact",
    "teal-light",
    "teal-dark",
    "adaptive",
}
SUPPORTED_ATTACK_DIRECTIONS = {"up", "down"}
SUPPORTED_FDR_DISPLAY_MODES = {"font", "fill"}
SUPPORTED_POSITION_COLOUR_SCALES = {"Classic", "Ocean", "Vibrant", "Custom"}
SUPPORTED_POSITION_COLOUR_MODES = {"name-font", "name-fill", "card-border", "card-fill"}
SUPPORTED_METRIC_COLOUR_SCALES = {"Blue", "Teal", "Purple", "Amber", "Custom"}
SUPPORTED_FDR_SCALES = {
    "BrBG",
    "RdBu",
    "RdYlGn",
    "Turbo",
    "Sinebow",
    "CustomBlueRedVibrant",
    "CustomGreenPurpleVibrant",
    "CustomHex",
    "CustomAll",
}
THEME_COLOUR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


class UserPreferenceService:
    def __init__(self, repository: InMemoryUserPreferenceRepository) -> None:
        self._repository = repository

    def get_preferences(self, user_id: str) -> UserPreferences:
        return self._repository.get_for_user(user_id)

    def update_preferences(self, user_id: str, preferences: UserPreferences) -> UserPreferences:
        # Older clients only send the legacy light/dark pair. Treat the legacy
        # light value as the primary accent while the new palette fields roll out.
        if "primary_theme_colour" not in preferences.model_fields_set:
            preferences = preferences.model_copy(
                update={"primary_theme_colour": preferences.light_theme_colour}
            )
        if "theme_colour_variants" not in preferences.model_fields_set:
            preferences = preferences.model_copy(
                update={
                    "theme_colour_variants": ThemeColourVariants(
                        light=ThemeAccentColours.model_construct(
                            primary=preferences.light_theme_colour,
                            secondary=preferences.secondary_theme_colour,
                            tertiary=preferences.tertiary_theme_colour,
                            quaternary=preferences.quaternary_theme_colour,
                        ),
                        dark=ThemeAccentColours.model_construct(
                            primary=preferences.dark_theme_colour,
                            secondary=preferences.secondary_theme_colour,
                            tertiary=preferences.tertiary_theme_colour,
                            quaternary=preferences.quaternary_theme_colour,
                        ),
                    )
                }
            )

        theme_variant_colours = [
            colour
            for variant in (
                preferences.theme_colour_variants.light,
                preferences.theme_colour_variants.dark,
            )
            for colour in (
                variant.primary,
                variant.secondary,
                variant.tertiary,
                variant.quaternary,
            )
        ]

        if (
            preferences.theme_preset not in SUPPORTED_THEME_PRESETS
            or preferences.attack_direction not in SUPPORTED_ATTACK_DIRECTIONS
            or preferences.fdr_scale not in SUPPORTED_FDR_SCALES
            or preferences.fdr_display_mode not in SUPPORTED_FDR_DISPLAY_MODES
            or preferences.position_colour_scale not in SUPPORTED_POSITION_COLOUR_SCALES
            or preferences.position_colour_mode not in SUPPORTED_POSITION_COLOUR_MODES
            or preferences.metric_colour_scale not in SUPPORTED_METRIC_COLOUR_SCALES
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.light_theme_colour)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.dark_theme_colour)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.primary_theme_colour)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.secondary_theme_colour)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.tertiary_theme_colour)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.quaternary_theme_colour)
            or any(not THEME_COLOUR_PATTERN.fullmatch(colour) for colour in theme_variant_colours)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.result_win_colour)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.result_draw_colour)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.result_loss_colour)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.fdr_custom_min)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.fdr_custom_second)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.fdr_custom_mid)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.fdr_custom_fourth)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.fdr_custom_max)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.position_custom_gkp)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.position_custom_def)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.position_custom_mid)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.position_custom_fwd)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.metric_custom_1)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.metric_custom_2)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.metric_custom_3)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.metric_custom_4)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.metric_custom_5)
        ):
            return self._repository.get_for_user(user_id)

        return self._repository.save_for_user(user_id, preferences)
