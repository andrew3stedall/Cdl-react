"""Authenticated routes for the persistent configured-season draft room."""

from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException

from cdl_api.contracts.live_draft import (
    AutoPickRequest,
    CorrectionRequest,
    CreateDraftRequest,
    PickRequest,
    QueueRequest,
)
from cdl_api.contracts.session import SessionUser
from cdl_api.database import build_session_factory
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.services.live_draft import LiveDraftError, LiveDraftService
from cdl_api.settings import Settings, get_settings

router = APIRouter(prefix="/live-draft", tags=["live-draft"])


def get_live_draft_service(settings: Settings = Depends(get_settings)) -> LiveDraftService:
    if settings.repository_mode != "postgres":
        raise HTTPException(
            status_code=503, detail="Persistent live draft requires PostgreSQL mode."
        )
    return LiveDraftService(build_session_factory(settings))


def _membership(service: LiveDraftService, user: SessionUser) -> dict[str, str]:
    membership = service.membership(user.id)
    if membership is None:
        raise HTTPException(status_code=403, detail="League membership required.")
    return membership


def _commissioner(service: LiveDraftService, user: SessionUser) -> dict[str, str]:
    membership = _membership(service, user)
    if membership.get("role") not in {"commissioner", "admin"}:
        raise HTTPException(status_code=403, detail="Commissioner permission required.")
    return membership


def _run[ResultT](action: Callable[[], ResultT]) -> ResultT:
    try:
        return action()
    except LiveDraftError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("")
def get_room(
    user: SessionUser = Depends(require_authenticated_session),
    service: LiveDraftService = Depends(get_live_draft_service),
) -> dict[str, object] | None:
    membership = _membership(service, user)
    return service.room(user.id, membership.get("team_id"), membership.get("role", "manager"))


@router.get("/teams")
def get_draft_teams(
    user: SessionUser = Depends(require_authenticated_session),
    service: LiveDraftService = Depends(get_live_draft_service),
) -> list[dict[str, str]]:
    _membership(service, user)
    return service.teams()


@router.post("")
def create_room(
    payload: CreateDraftRequest,
    user: SessionUser = Depends(require_authenticated_session),
    service: LiveDraftService = Depends(get_live_draft_service),
) -> dict[str, str]:
    _commissioner(service, user)
    draft_id = _run(
        lambda: service.create(
            actor_id=user.id,
            mode=payload.mode,
            rounds=payload.rounds,
            clock_enabled=payload.clock_enabled,
            pick_seconds=payload.pick_seconds,
            manual_team_order=payload.manual_team_order,
        )
    )
    return {"id": draft_id, "status": "setup"}


@router.post("/control/{action}")
def control_room(
    action: str,
    user: SessionUser = Depends(require_authenticated_session),
    service: LiveDraftService = Depends(get_live_draft_service),
) -> dict[str, str]:
    if action not in {"start", "pause", "resume", "complete"}:
        raise HTTPException(status_code=404, detail="Unknown draft action.")
    _commissioner(service, user)
    _run(lambda: service.control(user.id, action))
    return {"status": action}


@router.put("/queue")
def update_queue(
    payload: QueueRequest,
    user: SessionUser = Depends(require_authenticated_session),
    service: LiveDraftService = Depends(get_live_draft_service),
) -> dict[str, int]:
    membership = _membership(service, user)
    team_id = membership.get("team_id")
    if not team_id:
        raise HTTPException(status_code=403, detail="An assigned team is required.")
    _run(lambda: service.set_queue(user.id, team_id, payload.player_ids))
    return {"queued": len(payload.player_ids)}


@router.post("/pick")
def make_pick(
    payload: PickRequest,
    user: SessionUser = Depends(require_authenticated_session),
    service: LiveDraftService = Depends(get_live_draft_service),
) -> dict[str, object]:
    membership = _membership(service, user)
    team_id = membership.get("team_id")
    if not team_id:
        raise HTTPException(status_code=403, detail="An assigned team is required.")
    return _run(
        lambda: service.make_pick(
            actor_id=user.id,
            team_id=team_id,
            player_id=payload.player_id,
            idempotency_key=payload.idempotency_key,
        )
    )


@router.post("/auto-pick")
def auto_pick(
    payload: AutoPickRequest,
    user: SessionUser = Depends(require_authenticated_session),
    service: LiveDraftService = Depends(get_live_draft_service),
) -> dict[str, object]:
    membership = _membership(service, user)
    team_id = membership.get("team_id")
    if not team_id:
        raise HTTPException(status_code=403, detail="An assigned team is required.")
    return _run(
        lambda: service.make_pick(
            actor_id=user.id,
            team_id=team_id,
            player_id=None,
            idempotency_key=payload.idempotency_key,
            source="auto",
        )
    )


@router.post("/commissioner-pick/{team_id}")
def commissioner_pick(
    team_id: str,
    payload: PickRequest,
    user: SessionUser = Depends(require_authenticated_session),
    service: LiveDraftService = Depends(get_live_draft_service),
) -> dict[str, object]:
    _commissioner(service, user)
    return _run(
        lambda: service.make_pick(
            actor_id=user.id,
            team_id=team_id,
            player_id=payload.player_id,
            idempotency_key=payload.idempotency_key,
            source="commissioner_on_behalf",
            commissioner=True,
        )
    )


@router.post("/correction/{pick_number}")
def correct_pick(
    pick_number: int,
    payload: CorrectionRequest,
    user: SessionUser = Depends(require_authenticated_session),
    service: LiveDraftService = Depends(get_live_draft_service),
) -> dict[str, str]:
    _commissioner(service, user)
    _run(
        lambda: service.correct_pick(
            actor_id=user.id,
            pick_number=pick_number,
            player_id=payload.player_id,
            reason=payload.reason,
        )
    )
    return {"status": "corrected"}
