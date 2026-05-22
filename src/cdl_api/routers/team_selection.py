"""Team selection and chip API routes."""

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ErrorCode, ValidationErrorResponse
from cdl_api.contracts.team_selection import (
    ChipUpdateRequest,
    FixtureSummaryPanel,
    LineupUpdateRequest,
    TeamSelectionResponse,
)
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository
from cdl_api.services.team_selection import (
    ChipService,
    FixtureSummaryService,
    TeamSelectionService,
    TeamSelectionValidationError,
)

router = APIRouter(tags=["team-selection"])
_repository = InMemoryTeamSelectionRepository()
_team_service = TeamSelectionService(_repository)
_chip_service = ChipService(_repository)
_fixture_service = FixtureSummaryService(_repository)


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
def get_team_selection() -> TeamSelectionResponse:
    return _team_service.get_team_selection()


@router.put("/team-selection/lineup", response_model=TeamSelectionResponse)
def update_lineup(payload: LineupUpdateRequest) -> TeamSelectionResponse | JSONResponse:
    try:
        return _team_service.update_lineup(payload)
    except TeamSelectionValidationError as exc:
        return validation_response(exc)


@router.put("/team-selection/chips/{chip_id}", response_model=TeamSelectionResponse)
def update_chip(chip_id: str, payload: ChipUpdateRequest) -> TeamSelectionResponse | JSONResponse:
    try:
        return _chip_service.update_chip(chip_id, payload)
    except TeamSelectionValidationError as exc:
        return validation_response(exc)


@router.get("/team-selection/fixtures-summary", response_model=FixtureSummaryPanel)
def fixture_summary() -> FixtureSummaryPanel:
    return _fixture_service.get_summary()
