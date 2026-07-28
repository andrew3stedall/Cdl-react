"""User preference API routes."""

from fastapi import APIRouter, Depends

from cdl_api.contracts.session import SessionUser
from cdl_api.contracts.theme import UserPreferences
from cdl_api.repositories.factory import build_repositories
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.services.preferences import UserPreferenceService
from cdl_api.settings import Settings, get_settings

router = APIRouter(prefix="/me/preferences", tags=["preferences"])


def get_preference_service(settings: Settings = Depends(get_settings)) -> UserPreferenceService:
    repositories = build_repositories(settings)
    return UserPreferenceService(repositories.preferences)


@router.get("", response_model=UserPreferences)
def get_preferences(
    user: SessionUser = Depends(require_authenticated_session),
    service: UserPreferenceService = Depends(get_preference_service),
) -> UserPreferences:
    return service.get_preferences(user.id)


@router.put("", response_model=UserPreferences)
def update_preferences(
    preferences: UserPreferences,
    user: SessionUser = Depends(require_authenticated_session),
    service: UserPreferenceService = Depends(get_preference_service),
) -> UserPreferences:
    return service.update_preferences(user.id, preferences)
