"""User preference API routes."""

from fastapi import APIRouter, Depends

from cdl_api.contracts.theme import UserPreferences
from cdl_api.repositories.factory import build_repositories
from cdl_api.services.preferences import UserPreferenceService
from cdl_api.settings import Settings, get_settings

router = APIRouter(prefix="/me/preferences", tags=["preferences"])
DEMO_USER_ID = "user-1"


def get_preference_service(settings: Settings = Depends(get_settings)) -> UserPreferenceService:
    repositories = build_repositories(settings)
    return UserPreferenceService(repositories.preferences)


@router.get("", response_model=UserPreferences)
def get_preferences(
    service: UserPreferenceService = Depends(get_preference_service),
) -> UserPreferences:
    return service.get_preferences(DEMO_USER_ID)


@router.put("", response_model=UserPreferences)
def update_preferences(
    preferences: UserPreferences,
    service: UserPreferenceService = Depends(get_preference_service),
) -> UserPreferences:
    return service.update_preferences(DEMO_USER_ID, preferences)
