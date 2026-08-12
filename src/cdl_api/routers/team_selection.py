"""Team selection and chip API routes."""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ApiErrorResponse, ErrorCode, ValidationErrorResponse
from cdl_api.contracts.session import SessionUser
from cdl_api.contracts.team_selection import (
    ChipUpdateRequest,
    FixtureSummaryPanel,
    LineupUpdateRequest,
    TeamSelectionResponse,
)
from cdl_api.database import build_session_factory
from cdl_api.repositories.factory import build_repositories
from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository
from cdl_api.routers.auth import get_optional_authenticated_session
from cdl_api.services.team_selection import (
    ChipService,
    FixtureSummaryService,
    TeamSelectionLockedError,
    TeamSelectionService,
    TeamSelectionValidationError,
)
from cdl_api.settings import Settings, get_settings

router = APIRouter(tags=["team-selection"])


def get_team_selection_repository(
    settings: Settings = Depends(get_settings),
    user: SessionUser | None = Depends(get_optional_authenticated_session),
) -> InMemoryTeamSelectionRepository:
    if settings.repository_mode == "postgres":
        return PostgreSQLTeamSelectionRepository(
            build_session_factory(settings),
            user_id=user.id if user is not None else None,
        )
    repositories = build_repositories(settings)
    return repositories.team_selection


def get_team_selection_service(
    repository: InMemoryTeamSelectionRepository = Depends(get_team_selection_repository),
) -> TeamSelectionService:
    return TeamSelectionService(repository)


def get_chip_service(
    repository: InMemoryTeamSelectionRepository = Depends(get_team_selection_repository),
) -> ChipService:
    return ChipService(repository)


def get_fixture_summary_service(
    repository: InMemoryTeamSelectionRepository = Depends(get_team_selection_repository),
) -> FixtureSummaryService:
    return FixtureSummaryService(repository)


def validation_response(exc: TeamSelectionValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ValidationErrorResponse(
            code=ErrorCode.VALIDATION_ERROR,
            message=str(exc),
            issues=exc.issues,
        ).model_dump(mode="json"),
    )


def lock_response(exc: TeamSelectionLockedError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content=ApiErrorResponse(
            code=ErrorCode.CONFLICT,
            message=str(exc),
            details={
                "rule_reference": "lineup-locking",
                "fixture_id": exc.lock["fixture_id"],
                "lock_scope": exc.lock["lock_scope"],
                "locked_at": exc.lock["locked_at"],
                "reason": exc.lock["reason"],
            },
        ).model_dump(mode="json"),
    )


@router.get("/team-selection", response_model=TeamSelectionResponse)
def get_team_selection(
    service: TeamSelectionService = Depends(get_team_selection_service),
) -> TeamSelectionResponse:
    return service.get_team_selection()


@router.put("/team-selection/lineup", response_model=TeamSelectionResponse)
def update_lineup(
    payload: LineupUpdateRequest,
    service: TeamSelectionService = Depends(get_team_selection_service),
) -> TeamSelectionResponse | JSONResponse:
    try:
        return service.update_lineup(payload)
    except TeamSelectionLockedError as exc:
        return lock_response(exc)
    except TeamSelectionValidationError as exc:
        return validation_response(exc)


@router.put("/team-selection/chips/{chip_id}", response_model=TeamSelectionResponse)
def update_chip(
    chip_id: str,
    payload: ChipUpdateRequest,
    service: ChipService = Depends(get_chip_service),
) -> TeamSelectionResponse | JSONResponse:
    try:
        return service.update_chip(chip_id, payload)
    except TeamSelectionLockedError as exc:
        return lock_response(exc)
    except TeamSelectionValidationError as exc:
        return validation_response(exc)


@router.get("/team-selection/fixtures-summary", response_model=FixtureSummaryPanel)
def fixture_summary(
    service: FixtureSummaryService = Depends(get_fixture_summary_service),
) -> FixtureSummaryPanel:
    return service.get_summary()
