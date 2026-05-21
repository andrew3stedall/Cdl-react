from cdl_api.contracts.theme import UserPreferences
from cdl_api.repositories.preferences import InMemoryUserPreferenceRepository
from cdl_api.services.preferences import UserPreferenceService


def test_preference_service_returns_default_theme() -> None:
    service = UserPreferenceService(InMemoryUserPreferenceRepository())

    preferences = service.get_preferences("manager-1")

    assert preferences.theme_preset == "classic"


def test_preference_service_persists_supported_theme() -> None:
    service = UserPreferenceService(InMemoryUserPreferenceRepository())

    updated = service.update_preferences("manager-1", UserPreferences(theme_preset="dark"))

    assert updated.theme_preset == "dark"
    assert service.get_preferences("manager-1").theme_preset == "dark"


def test_preference_service_rejects_unsupported_theme() -> None:
    service = UserPreferenceService(InMemoryUserPreferenceRepository())

    updated = service.update_preferences("manager-1", UserPreferences(theme_preset="unknown"))

    assert updated.theme_preset == "classic"
