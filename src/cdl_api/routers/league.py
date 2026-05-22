"""League fixture and table API routes."""

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ApiErrorResponse, ErrorCode
from cdl_api.contracts.league_models import (
    FixtureDetailResponse,
    HeadToHeadResponse,
    KnockoutResponse,
    LeagueFixturesResponse,
    LeagueTableResponse,
)
from cdl_api.services.league_service import (
    FixtureService,
    HeadToHeadService,
    KnockoutService,
    LeagueTableService,
)

router = APIRouter(prefix="/league", tags=["league"])

_fixture_service = FixtureService()
_table_service = LeagueTableService()
_knockout_service = KnockoutService()
_head_to_head_service = HeadToHeadService()


@router.get("/fixtures/current", response_model=LeagueFixturesResponse)
def current_fixtures() -> LeagueFixturesResponse:
    return _fixture_service.list_current()


@router.get("/fixtures/next", response_model=LeagueFixturesResponse)
def next_fixtures() -> LeagueFixturesResponse:
    return _fixture_service.list_next()


@router.get("/fixtures", response_model=LeagueFixturesResponse)
def all_fixtures() -> LeagueFixturesResponse:
    return _fixture_service.list_all()


@router.get(
    "/fixtures/{fixture_id}",
    response_model=FixtureDetailResponse,
    responses={status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse}},
)
def fixture_detail(fixture_id: str) -> FixtureDetailResponse | JSONResponse:
    detail = _fixture_service.get_detail(fixture_id)
    if detail is not None:
        return detail

    error = ApiErrorResponse(
        code=ErrorCode.NOT_FOUND,
        message="Fixture detail missing or unavailable.",
        details={"fixture_id": fixture_id},
    )
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=error.model_dump(mode="json"),
    )


@router.get("/table", response_model=LeagueTableResponse)
def league_table() -> LeagueTableResponse:
    return _table_service.get_table()


@router.get("/knockout", response_model=KnockoutResponse)
def knockout() -> KnockoutResponse:
    return _knockout_service.get_knockout()


@router.get("/head-to-head", response_model=HeadToHeadResponse)
def head_to_head() -> HeadToHeadResponse:
    return _head_to_head_service.get_records()
