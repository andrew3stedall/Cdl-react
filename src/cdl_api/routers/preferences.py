"""User preference API routes."""

from fastapi import APIRouter, Depends, HTTPException, status

from cdl_api.contracts.session import SessionUser
from cdl_api.contracts.theme import (
    FdrCustomPalette,
    FdrCustomPaletteCreate,
    PlayerColourPalette,
    PlayerColourPaletteCreate,
    UserPreferences,
)
from cdl_api.repositories.factory import build_repositories
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.services.fdr_custom_palettes import FdrCustomPaletteService
from cdl_api.services.player_colour_palettes import PlayerColourPaletteService
from cdl_api.services.preferences import UserPreferenceService
from cdl_api.settings import Settings, get_settings

router = APIRouter(prefix="/me/preferences", tags=["preferences"])


def get_preference_service(settings: Settings = Depends(get_settings)) -> UserPreferenceService:
    repositories = build_repositories(settings)
    return UserPreferenceService(repositories.preferences)


def get_fdr_custom_palette_service(
    settings: Settings = Depends(get_settings),
) -> FdrCustomPaletteService:
    repositories = build_repositories(settings)
    return FdrCustomPaletteService(repositories.fdr_custom_palettes)


def get_player_colour_palette_service(
    settings: Settings = Depends(get_settings),
) -> PlayerColourPaletteService:
    repositories = build_repositories(settings)
    return PlayerColourPaletteService(repositories.player_colour_palettes)


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


@router.get("/fdr-palettes", response_model=list[FdrCustomPalette])
def get_fdr_custom_palettes(
    user: SessionUser = Depends(require_authenticated_session),
    service: FdrCustomPaletteService = Depends(get_fdr_custom_palette_service),
) -> list[FdrCustomPalette]:
    return service.list_palettes(user.id)


@router.post("/fdr-palettes", response_model=FdrCustomPalette, status_code=status.HTTP_201_CREATED)
def create_fdr_custom_palette(
    payload: FdrCustomPaletteCreate,
    user: SessionUser = Depends(require_authenticated_session),
    service: FdrCustomPaletteService = Depends(get_fdr_custom_palette_service),
) -> FdrCustomPalette:
    try:
        return service.create_palette(user.id, payload)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.delete("/fdr-palettes/{palette_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fdr_custom_palette(
    palette_id: str,
    user: SessionUser = Depends(require_authenticated_session),
    service: FdrCustomPaletteService = Depends(get_fdr_custom_palette_service),
) -> None:
    if not service.delete_palette(user.id, palette_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom palette not found.",
        )


@router.get("/player-palettes", response_model=list[PlayerColourPalette])
def get_player_colour_palettes(
    user: SessionUser = Depends(require_authenticated_session),
    service: PlayerColourPaletteService = Depends(get_player_colour_palette_service),
) -> list[PlayerColourPalette]:
    return service.list_palettes(user.id)


@router.post(
    "/player-palettes",
    response_model=PlayerColourPalette,
    status_code=status.HTTP_201_CREATED,
)
def create_player_colour_palette(
    payload: PlayerColourPaletteCreate,
    user: SessionUser = Depends(require_authenticated_session),
    service: PlayerColourPaletteService = Depends(get_player_colour_palette_service),
) -> PlayerColourPalette:
    try:
        return service.create_palette(user.id, payload)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.delete("/player-palettes/{palette_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player_colour_palette(
    palette_id: str,
    user: SessionUser = Depends(require_authenticated_session),
    service: PlayerColourPaletteService = Depends(get_player_colour_palette_service),
) -> None:
    if not service.delete_palette(user.id, palette_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Player colour palette not found.",
        )
