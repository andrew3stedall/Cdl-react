"""Private scouting controls and CDL ownership history."""

from fastapi import APIRouter, Depends, HTTPException

from cdl_api.contracts.scouting import OwnershipHistory, ScoutingNote, ScoutingNoteUpdate
from cdl_api.contracts.session import SessionUser
from cdl_api.database import build_session_factory
from cdl_api.repositories.private_scouting import PrivateScoutingRepository
from cdl_api.routers.squad import require_manager_session
from cdl_api.settings import Settings, get_settings
from cdl_api.staging_draft_seed import (
    LEAGUE_ID,
    UnassignedManagerContextError,
    resolve_staging_manager_context,
)

router = APIRouter(tags=["private-scouting"])


def get_scouting_repository(
    user: SessionUser = Depends(require_manager_session),
    settings: Settings = Depends(get_settings),
) -> PrivateScoutingRepository:
    if settings.repository_mode != "postgres":
        raise HTTPException(status_code=503, detail="Private scouting requires persistent storage.")
    factory = build_session_factory(settings)
    try:
        resolve_staging_manager_context(factory, user.id)
    except UnassignedManagerContextError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return PrivateScoutingRepository(factory, user.id, LEAGUE_ID)


@router.get("/me/watchlist", response_model=list[ScoutingNote])
def list_watchlist(
    repository: PrivateScoutingRepository = Depends(get_scouting_repository),
) -> list[ScoutingNote]:
    return repository.list_watchlist()


@router.get("/me/scouting/{player_id}", response_model=ScoutingNote)
def get_scouting(
    player_id: str, repository: PrivateScoutingRepository = Depends(get_scouting_repository)
) -> ScoutingNote:
    try:
        return repository.get_note(player_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/me/scouting/{player_id}", response_model=ScoutingNote)
def save_scouting(
    player_id: str,
    payload: ScoutingNoteUpdate,
    repository: PrivateScoutingRepository = Depends(get_scouting_repository),
) -> ScoutingNote:
    try:
        return repository.save_note(player_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/players/{player_id}/cdl-history", response_model=OwnershipHistory)
def get_ownership_history(
    player_id: str, repository: PrivateScoutingRepository = Depends(get_scouting_repository)
) -> OwnershipHistory:
    try:
        return repository.ownership_history(player_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
