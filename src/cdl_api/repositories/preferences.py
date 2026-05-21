"""User preference repository implementations."""

from cdl_api.contracts.theme import UserPreferences


class InMemoryUserPreferenceRepository:
    """Store user preferences for the API process until persistent storage exists."""

    def __init__(self) -> None:
        self._preferences_by_user_id: dict[str, UserPreferences] = {}

    def get_for_user(self, user_id: str) -> UserPreferences:
        return self._preferences_by_user_id.get(user_id, UserPreferences())

    def save_for_user(self, user_id: str, preferences: UserPreferences) -> UserPreferences:
        self._preferences_by_user_id[user_id] = preferences
        return preferences
