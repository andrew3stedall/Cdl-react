"""User preference service."""

import re

from cdl_api.contracts.theme import UserPreferences
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
        if (
            preferences.theme_preset not in SUPPORTED_THEME_PRESETS
            or preferences.attack_direction not in SUPPORTED_ATTACK_DIRECTIONS
            or preferences.fdr_scale not in SUPPORTED_FDR_SCALES
            or preferences.fdr_display_mode not in SUPPORTED_FDR_DISPLAY_MODES
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.light_theme_colour)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.dark_theme_colour)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.fdr_custom_min)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.fdr_custom_second)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.fdr_custom_mid)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.fdr_custom_fourth)
            or not THEME_COLOUR_PATTERN.fullmatch(preferences.fdr_custom_max)
        ):
            return self._repository.get_for_user(user_id)

        return self._repository.save_for_user(user_id, preferences)
