"""League fixture and table API routes."""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ApiErrorResponse, ErrorCode
from cdl_api.contracts.league_models import (
    FixtureDetailResponse,
    FixtureSquad,
    FixtureSquadPlayer,
    HeadToHeadResponse,
    KnockoutResponse,
    LeagueFixturesResponse,
    LeagueTableResponse,
)
from cdl_api.database import build_session_factory
from cdl_api.repositories.factory import build_repositories
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.repositories.squad import SquadRepository
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


def get_fixture_squad_repository(
    settings: Settings = Depends(get_settings),
) -> SquadRepository:
    if settings.repository_mode == "postgres":
        return PostgreSQLSquadRepository(build_session_factory(settings))
    return build_repositories(settings).squad


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


@router.get("/fixtures/{fixture_id}/squads", response_model=list[FixtureSquad])
def fixture_squads(
    fixture_id: str,
    repository: LeagueReadRepository = Depends(get_league_repository),
    squad_repository: SquadRepository = Depends(get_fixture_squad_repository),
) -> list[FixtureSquad] | JSONResponse:
    fixture = repository.get_fixture(fixture_id)
    if fixture is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Fixture not found."},
        )
    players = squad_repository.list_squad_players()
    squads = []
    for team in (fixture.home_team, fixture.away_team):
        owned = [
            player for player in players if player.draft_team and player.draft_team.id == team.id
        ]
        by_position = {
            position: sorted(
                (player for player in owned if player.position == position),
                key=lambda player: (-player.points, -player.form, player.display_name),
            )
            for position in ("GKP", "DEF", "MID", "FWD")
        }
        starters = [
            *by_position["GKP"][:1],
            *by_position["DEF"][:4],
            *by_position["MID"][:4],
            *by_position["FWD"][:2],
        ]
        starter_ids = {player.id for player in starters}
        squads.append(
            FixtureSquad(
                team=team,
                starters=[
                    FixtureSquadPlayer(
                        id=player.id,
                        display_name=player.display_name,
                        position=player.position or "",
                        points=player.points,
                        form=player.form,
                        slot="starter",
                    )
                    for player in starters
                ],
                bench=[
                    FixtureSquadPlayer(
                        id=player.id,
                        display_name=player.display_name,
                        position=player.position or "",
                        points=player.points,
                        form=player.form,
                        slot="bench",
                    )
                    for player in owned
                    if player.id not in starter_ids
                ],
            )
        )
    return squads


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
