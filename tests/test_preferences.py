from cdl_api.contracts.theme import UserPreferences
from cdl_api.repositories.preferences import InMemoryUserPreferenceRepository
from cdl_api.services.preferences import UserPreferenceService


def test_preference_service_returns_default_theme() -> None:
    service = UserPreferenceService(InMemoryUserPreferenceRepository())

    preferences = service.get_preferences("manager-1")

    assert preferences.theme_preset == "teal-light"
    assert preferences.attack_direction == "up"
    assert preferences.fdr_scale == "RdYlGn"
    assert preferences.fdr_scale_reversed is True
    assert preferences.fdr_display_mode == "font"


def test_preference_service_persists_supported_theme() -> None:
    service = UserPreferenceService(InMemoryUserPreferenceRepository())

    updated = service.update_preferences(
        "manager-1",
        UserPreferences(
            theme_preset="teal-dark",
            attack_direction="down",
            fdr_scale="Viridis",
            fdr_scale_reversed=False,
            fdr_display_mode="fill",
        ),
    )

    assert updated.theme_preset == "teal-dark"
    assert updated.attack_direction == "down"
    assert updated.fdr_scale == "Viridis"
    assert updated.fdr_scale_reversed is False
    assert updated.fdr_display_mode == "fill"
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


def test_preference_service_rejects_unsupported_fdr_scale() -> None:
    service = UserPreferenceService(InMemoryUserPreferenceRepository())

    updated = service.update_preferences(
        "manager-1",
        UserPreferences(theme_preset="teal-light", fdr_scale="not-a-scale"),
    )

    assert updated.fdr_scale == "RdYlGn"


def test_preference_service_rejects_unsupported_fdr_display_mode() -> None:
    service = UserPreferenceService(InMemoryUserPreferenceRepository())

    updated = service.update_preferences(
        "manager-1",
        UserPreferences(theme_preset="teal-light", fdr_display_mode="outline"),
    )

    assert updated.fdr_display_mode == "font"
