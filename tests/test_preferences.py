from cdl_api.contracts.theme import UserPreferences
from cdl_api.repositories.preferences import InMemoryUserPreferenceRepository
from cdl_api.services.preferences import UserPreferenceService


def test_preference_service_returns_default_theme() -> None:
    service = UserPreferenceService(InMemoryUserPreferenceRepository())

    preferences = service.get_preferences("manager-1")

    assert preferences.theme_preset == "teal-light"
    assert preferences.attack_direction == "up"


def test_preference_service_persists_supported_theme() -> None:
    service = UserPreferenceService(InMemoryUserPreferenceRepository())

    updated = service.update_preferences(
        "manager-1", UserPreferences(theme_preset="teal-dark", attack_direction="down")
    )

    assert updated.theme_preset == "teal-dark"
    assert updated.attack_direction == "down"
    assert service.get_preferences("manager-1").theme_preset == "teal-dark"
    assert service.get_preferences("manager-1").attack_direction == "down"


def test_preference_service_rejects_unsupported_theme() -> None:
    service = UserPreferenceService(InMemoryUserPreferenceRepository())

    updated = service.update_preferences("manager-1", UserPreferences(theme_preset="unknown"))

    assert updated.theme_preset == "teal-light"


def test_preference_service_rejects_unsupported_attack_direction() -> None:
    service = UserPreferenceService(InMemoryUserPreferenceRepository())

    updated = service.update_preferences(
        "manager-1", UserPreferences(theme_preset="teal-light", attack_direction="sideways")
    )

    assert updated.attack_direction == "up"
