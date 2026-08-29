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
from cdl_api.contracts.session import SessionUser
from cdl_api.database import build_session_factory
from cdl_api.repositories.factory import build_repositories
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.repositories.postgres_team_selection import PostgreSQLTeamSelectionRepository
from cdl_api.repositories.squad import SquadRepository
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository
from cdl_api.routers.auth import get_optional_authenticated_session
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
    user: SessionUser | None = Depends(get_optional_authenticated_session),
) -> SquadRepository:
    if settings.repository_mode == "postgres":
        return PostgreSQLSquadRepository(
            build_session_factory(settings),
            user_id=user.id if user is not None else None,
        )
    return build_repositories(settings).squad


def get_fixture_team_selection_repository(
    settings: Settings = Depends(get_settings),
    user: SessionUser | None = Depends(get_optional_authenticated_session),
) -> InMemoryTeamSelectionRepository:
    if settings.repository_mode == "postgres":
        return PostgreSQLTeamSelectionRepository(
            build_session_factory(settings),
            user_id=user.id if user is not None else None,
        )
    return build_repositories(settings).team_selection


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
    team_selection_repository: InMemoryTeamSelectionRepository = Depends(
        get_fixture_team_selection_repository
    ),
) -> list[FixtureSquad] | JSONResponse:
    fixture = repository.get_fixture(fixture_id)
    if fixture is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Fixture not found."},
        )

    historical_squad_loader = getattr(
        team_selection_repository,
        "get_historical_fixture_squads",
        None,
    )
    fixture_contexts = _fixture_contexts_for_gameweek(squad_repository, fixture.gameweek.number)
    if fixture.status != "pending" and historical_squad_loader is not None:
        historical_squads = historical_squad_loader(fixture)
        if historical_squads:
            return _attach_fixture_contexts(historical_squads, fixture_contexts)
        # Never show today's squad as a completed fixture's lineup. If the
        # frozen historical record is unavailable, the UI can state that
        # lineup detail is not yet available instead of showing wrong players.
        if fixture.status == "complete":
            return []

    players = squad_repository.list_squad_players()
    manager_team = getattr(squad_repository, "manager_team", None)
    user_team_id = manager_team.id if manager_team is not None else None
    selection_by_id = {player.id: player for player in team_selection_repository.get_players()}
    squads = []
    for team in (fixture.home_team, fixture.away_team):
        owned = [
            player for player in players if player.draft_team and player.draft_team.id == team.id
        ]
        owned_by_id = {player.id: player for player in owned}
        by_position = {
            position: sorted(
                (player for player in owned if player.position == position),
                key=lambda player: (-player.points, -player.form, player.display_name),
            )
            for position in ("GKP", "DEF", "MID", "FWD")
        }
        best_starters = [
            *by_position["GKP"][:1],
            *by_position["DEF"][:4],
            *by_position["MID"][:4],
            *by_position["FWD"][:2],
        ]
        is_user_team = team.id == user_team_id
        saved_starters = [
            player
            for player in selection_by_id.values()
            if getattr(player.slot, "value", player.slot) == "starter" and player.id in owned_by_id
        ]
        saved_lineup = sorted(
            (player for player in selection_by_id.values() if player.id in owned_by_id),
            key=lambda player: player.slot_order,
        )
        has_saved_lineup = is_user_team and len(saved_starters) == 11
        starters = (
            [
                owned_by_id[player.id]
                for player in saved_lineup
                if getattr(player.slot, "value", player.slot) == "starter"
            ]
            if has_saved_lineup
            else best_starters
        )
        starter_ids = {player.id for player in starters}
        if has_saved_lineup:
            bench_players = [
                owned_by_id[player.id]
                for player in saved_lineup
                if getattr(player.slot, "value", player.slot) == "bench"
            ][:5]
            reserve_players = [
                owned_by_id[player.id]
                for player in saved_lineup
                if getattr(player.slot, "value", player.slot) == "reserve"
            ]
        else:
            remaining_players = [player for player in owned if player.id not in starter_ids]
            bench_players = remaining_players[:5]
            reserve_players = remaining_players[5:]
        bench_ids = {player.id for player in bench_players}

        def as_fixture_player(player: object, slot: str) -> FixtureSquadPlayer:
            selection = selection_by_id.get(player.id)
            return FixtureSquadPlayer(
                id=player.id,
                display_name=player.display_name,
                position=player.position or "",
                club=player.epl_team,
                next_opponent=player.next_fixture.opponent if player.next_fixture else None,
                next_fixture_is_home=player.next_fixture.is_home if player.next_fixture else None,
                next_fixture_difficulty=(
                    player.next_fixture.difficulty if player.next_fixture else None
                ),
                fixture_fixtures=fixture_contexts.get(player.epl_team.id, []),
                points=player.points,
                form=player.form,
                slot=slot,
                is_captain=bool(selection and selection.is_captain),
                is_vice_captain=bool(selection and selection.is_vice_captain),
            )

        squads.append(
            FixtureSquad(
                team=team,
                is_user_team=is_user_team,
                players=[
                    as_fixture_player(
                        player,
                        "starter"
                        if player.id in starter_ids
                        else "bench"
                        if player.id in bench_ids
                        else "reserve",
                    )
                    for player in owned
                ],
                starters=[as_fixture_player(player, "starter") for player in starters],
                bench=[as_fixture_player(player, "bench") for player in bench_players],
                reserves=[as_fixture_player(player, "reserve") for player in reserve_players],
            )
        )
    return squads

def _fixture_contexts_for_gameweek(
    squad_repository: SquadRepository,
    gameweek_number: int,
) -> dict[str, list[object]]:
    loader = getattr(squad_repository, "fixture_contexts_by_team", None)
    if not callable(loader):
        return {}
    return loader(gameweek_number)


def _attach_fixture_contexts(
    squads: list[FixtureSquad],
    fixture_contexts: dict[str, list[object]],
) -> list[FixtureSquad]:
    if not fixture_contexts:
        return squads
    return [
        squad.model_copy(
            update={
                "players": [
                    player.model_copy(
                        update={
                            "fixture_fixtures": fixture_contexts.get(
                                player.club.id if player.club is not None else "", []
                            )
                        }
                    )
                    for player in squad.players
                ],
                "starters": [
                    player.model_copy(
                        update={
                            "fixture_fixtures": fixture_contexts.get(
                                player.club.id if player.club is not None else "", []
                            )
                        }
                    )
                    for player in squad.starters
                ],
                "bench": [
                    player.model_copy(
                        update={
                            "fixture_fixtures": fixture_contexts.get(
                                player.club.id if player.club is not None else "", []
                            )
                        }
                    )
                    for player in squad.bench
                ],
                "reserves": [
                    player.model_copy(
                        update={
                            "fixture_fixtures": fixture_contexts.get(
                                player.club.id if player.club is not None else "", []
                            )
                        }
                    )
                    for player in squad.reserves
                ],
            }
        )
        for squad in squads
    ]


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
