"""User preference API routes."""

from fastapi import APIRouter

from cdl_api.contracts.theme import UserPreferences
from cdl_api.repositories.preferences import InMemoryUserPreferenceRepository
from cdl_api.services.preferences import UserPreferenceService

router = APIRouter(prefix="/me/preferences", tags=["preferences"])
_service = UserPreferenceService(InMemoryUserPreferenceRepository())
DEMO_USER_ID = "demo-manager"


@router.get("", response_model=UserPreferences)
def get_preferences() -> UserPreferences:
    return _service.get_preferences(DEMO_USER_ID)


@router.put("", response_model=UserPreferences)
def update_preferences(preferences: UserPreferences) -> UserPreferences:
    return _service.update_preferences(DEMO_USER_ID, preferences)
