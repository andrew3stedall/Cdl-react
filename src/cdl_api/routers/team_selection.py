"""Team selection and chip API routes."""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ErrorCode, ValidationErrorResponse
from cdl_api.contracts.team_selection import (
    ChipUpdateRequest,
    FixtureSummaryPanel,
    LineupUpdateRequest,
    TeamSelectionResponse,
)
from cdl_api.repositories.factory import build_repositories
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository
from cdl_api.services.team_selection import (
    ChipService,
    FixtureSummaryService,
    TeamSelectionService,
    TeamSelectionValidationError,
)
from cdl_api.settings import Settings, get_settings

router = APIRouter(tags=["team-selection"])


def get_team_selection_repository(
    settings: Settings = Depends(get_settings),
) -> InMemoryTeamSelectionRepository:
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
    except TeamSelectionValidationError as exc:
        return validation_response(exc)


@router.get("/team-selection/fixtures-summary", response_model=FixtureSummaryPanel)
def fixture_summary(
    service: FixtureSummaryService = Depends(get_fixture_summary_service),
) -> FixtureSummaryPanel:
    return service.get_summary()
