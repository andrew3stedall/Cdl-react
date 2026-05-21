"""User preference service."""

from cdl_api.contracts.theme import UserPreferences
from cdl_api.repositories.preferences import InMemoryUserPreferenceRepository

SUPPORTED_THEME_PRESETS = {"classic", "dark", "compact"}


class UserPreferenceService:
    def __init__(self, repository: InMemoryUserPreferenceRepository) -> None:
        self._repository = repository

    def get_preferences(self, user_id: str) -> UserPreferences:
        return self._repository.get_for_user(user_id)

    def update_preferences(self, user_id: str, preferences: UserPreferences) -> UserPreferences:
        if preferences.theme_preset not in SUPPORTED_THEME_PRESETS:
            return self._repository.get_for_user(user_id)

        return self._repository.save_for_user(user_id, preferences)
