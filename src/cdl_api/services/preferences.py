"""User preference service."""

from cdl_api.contracts.theme import UserPreferences
from cdl_api.repositories.preferences import InMemoryUserPreferenceRepository

SUPPORTED_THEME_PRESETS = {
    "classic",
    "dark",
    "compact",
    "teal-light",
    "teal-dark",
    "teal-light-compact",
    "teal-dark-compact",
}
SUPPORTED_ATTACK_DIRECTIONS = {"up", "down"}
SUPPORTED_FDR_SCALES = {
    "BrBG",
    "PRGn",
    "PiYG",
    "PuOr",
    "RdBu",
    "RdGy",
    "RdYlBu",
    "RdYlGn",
    "Spectral",
    "Blues",
    "Greens",
    "Greys",
    "Oranges",
    "Purples",
    "Reds",
    "Turbo",
    "Viridis",
    "Inferno",
    "Magma",
    "Plasma",
    "Cividis",
    "Warm",
    "Cool",
    "CubehelixDefault",
    "BuGn",
    "BuPu",
    "GnBu",
    "OrRd",
    "PuBuGn",
    "PuBu",
    "PuRd",
    "RdPu",
    "YlGnBu",
    "YlGn",
    "YlOrBr",
    "YlOrRd",
    "Rainbow",
    "Sinebow",
}


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
        ):
            return self._repository.get_for_user(user_id)

        return self._repository.save_for_user(user_id, preferences)
