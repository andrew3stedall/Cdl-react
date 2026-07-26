"""League fixture and table API routes."""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ApiErrorResponse, ErrorCode
from cdl_api.contracts.league_models import (
    FixtureDetailResponse,
    HeadToHeadResponse,
    KnockoutResponse,
    LeagueFixturesResponse,
    LeagueTableResponse,
)
from cdl_api.repositories.factory import build_repositories
from cdl_api.services.league_service import (
    FixtureService,
    HeadToHeadService,
    KnockoutService,
    LeagueReadRepository,
    LeagueTableService,
)
from cdl_api.settings import Settings, get_settings

router = APIRouter(prefix="/league", tags=["league"])


def get_league_repository(
    settings: Settings = Depends(get_settings),
) -> LeagueReadRepository:
    return build_repositories(settings).league


@router.get("/fixtures/current", response_model=LeagueFixturesResponse)
def current_fixtures(
    repository: LeagueReadRepository = Depends(get_league_repository),
) -> LeagueFixturesResponse:
    return FixtureService(repository).list_current()


@router.get("/fixtures/next", response_model=LeagueFixturesResponse)
def next_fixtures(
    repository: LeagueReadRepository = Depends(get_league_repository),
) -> LeagueFixturesResponse:
    return FixtureService(repository).list_next()


@router.get("/fixtures", response_model=LeagueFixturesResponse)
def all_fixtures(
    repository: LeagueReadRepository = Depends(get_league_repository),
) -> LeagueFixturesResponse:
    return FixtureService(repository).list_all()


@router.get(
    "/fixtures/{fixture_id}",
    response_model=FixtureDetailResponse,
    responses={status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse}},
)
def fixture_detail(
    fixture_id: str,
    repository: LeagueReadRepository = Depends(get_league_repository),
) -> FixtureDetailResponse | JSONResponse:
    detail = FixtureService(repository).get_detail(fixture_id)
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
def league_table(
    repository: LeagueReadRepository = Depends(get_league_repository),
) -> LeagueTableResponse:
    return LeagueTableService(repository).get_table()


@router.get("/knockout", response_model=KnockoutResponse)
def knockout(
    repository: LeagueReadRepository = Depends(get_league_repository),
) -> KnockoutResponse:
    return KnockoutService(repository).get_knockout()


@router.get("/head-to-head", response_model=HeadToHeadResponse)
def head_to_head(
    repository: LeagueReadRepository = Depends(get_league_repository),
) -> HeadToHeadResponse:
    return HeadToHeadService(repository).get_records()
