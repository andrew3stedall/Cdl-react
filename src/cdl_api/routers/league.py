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
    LeagueInvitePreviewResponse,
    LeagueInviteRequest,
    LeagueInviteResponse,
    LeagueJoinResponse,
    LeagueManagementResponse,
    LeagueTableResponse,
)
from cdl_api.contracts.session import SessionUser
from cdl_api.database import build_session_factory
from cdl_api.repositories.factory import build_repositories
from cdl_api.repositories.league_memberships import (
    InMemoryLeagueMembershipRepository,
    PostgreSQLLeagueMembershipRepository,
)
from cdl_api.repositories.live_league import LiveAwarePostgreSQLTeamSelectionRepository
from cdl_api.repositories.postgres_squad_repository import PostgreSQLSquadRepository
from cdl_api.repositories.squad import SquadRepository
from cdl_api.repositories.team_selection import InMemoryTeamSelectionRepository
from cdl_api.routers.auth import get_optional_authenticated_session, require_authenticated_session
from cdl_api.services.league_service import (
    FixtureService,
    HeadToHeadService,
    KnockoutService,
    LeagueReadRepository,
    LeagueTableService,
)
from cdl_api.settings import Settings, get_settings

router = APIRouter(prefix="/league", tags=["league"])


def get_membership_repository(
    settings: Settings = Depends(get_settings),
) -> InMemoryLeagueMembershipRepository | PostgreSQLLeagueMembershipRepository:
    return build_repositories(settings).league_memberships


def _is_commissioner(user: SessionUser, settings: Settings) -> bool:
    return bool(
        {"commissioner", "admin"}.intersection(user.roles)
        or user.email.lower() in settings.commissioner_email_set
    )


def _forbidden() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={
            "code": "forbidden",
            "message": "Commissioner access is required.",
            "details": {},
        },
    )


@router.get("/management", response_model=LeagueManagementResponse)
def league_management(
    user: SessionUser = Depends(require_authenticated_session),
    settings: Settings = Depends(get_settings),
    repository: InMemoryLeagueMembershipRepository | PostgreSQLLeagueMembershipRepository = Depends(
        get_membership_repository
    ),
) -> LeagueManagementResponse | JSONResponse:
    if not _is_commissioner(user, settings):
        return _forbidden()
    try:
        league_name, available_team_count, teams = repository.league_management()
    except LookupError as exc:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"code": "not_found", "message": str(exc), "details": {}},
        )
    return LeagueManagementResponse(
        league_name=league_name,
        available_team_count=available_team_count,
        teams=[
            {
                "team_id": team.team_id,
                "team_name": team.team_name,
                "manager_name": team.manager_name,
                "manager_email": team.manager_email,
                "is_assigned": team.is_assigned,
            }
            for team in teams
        ],
    )


@router.post("/management/invites", response_model=LeagueInviteResponse)
def create_league_invite(
    payload: LeagueInviteRequest,
    user: SessionUser = Depends(require_authenticated_session),
    settings: Settings = Depends(get_settings),
    repository: InMemoryLeagueMembershipRepository | PostgreSQLLeagueMembershipRepository = Depends(
        get_membership_repository
    ),
) -> LeagueInviteResponse | JSONResponse:
    if not _is_commissioner(user, settings):
        return _forbidden()
    try:
        invite = repository.create_invite(user.id, payload.team_id)
    except LookupError as exc:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"code": "not_found", "message": str(exc), "details": {}},
        )
    except RuntimeError as exc:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"code": "conflict", "message": str(exc), "details": {}},
        )
    return LeagueInviteResponse(
        league_name=invite.league_name,
        team_id=invite.team_id,
        team_name=invite.team_name,
        token=invite.token,
        available_team_count=invite.available_team_count,
    )


@router.get(
    "/invites/{token}",
    response_model=LeagueInvitePreviewResponse,
    responses={status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse}},
)
def preview_league_invite(
    token: str,
    repository: InMemoryLeagueMembershipRepository | PostgreSQLLeagueMembershipRepository = Depends(
        get_membership_repository
    ),
) -> LeagueInvitePreviewResponse | JSONResponse:
    preview = repository.preview_invite(token)
    if preview is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "code": "not_found",
                "message": "This invite link is invalid or has expired.",
                "details": {},
            },
        )
    return LeagueInvitePreviewResponse(
        league_name=preview.league_name,
        team_id=preview.team_id,
        team_name=preview.team_name,
        available_team_count=preview.available_team_count,
    )


@router.post("/invites/{token}/accept", response_model=LeagueJoinResponse)
def accept_league_invite(
    token: str,
    user: SessionUser = Depends(require_authenticated_session),
    repository: InMemoryLeagueMembershipRepository | PostgreSQLLeagueMembershipRepository = Depends(
        get_membership_repository
    ),
) -> LeagueJoinResponse | JSONResponse:
    try:
        joined = repository.accept_invite(token, user.id, user.email, user.display_name)
    except LookupError as exc:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"code": "not_found", "message": str(exc), "details": {}},
        )
    except RuntimeError as exc:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"code": "conflict", "message": str(exc), "details": {}},
        )
    return LeagueJoinResponse(
        league_name=joined.league_name,
        team_id=joined.team_id,
        team_name=joined.team_name,
        already_member=joined.already_member,
    )


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
        return LiveAwarePostgreSQLTeamSelectionRepository(
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
            history_by_player = _form_history_for_players(
                squad_repository,
                [player.id for squad in historical_squads for player in squad.players],
            )
            return _attach_fixture_contexts(
                _attach_form_history(historical_squads, history_by_player),
                fixture_contexts,
            )
        # Once a gameweek has started, never fall back to today's mutable squad
        # or season totals. Missing locked data should be explicit rather than wrong.
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
                points_multiplier=2 if selection and selection.is_captain else 1,
                form=player.form,
                form_history=player.form_history,
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


def _form_history_for_players(
    squad_repository: SquadRepository,
    player_ids: list[str],
) -> dict[str, list[object]]:
    loader = getattr(squad_repository, "form_history_for_players", None)
    if not callable(loader):
        return {}
    return loader(player_ids)


def _attach_form_history(
    squads: list[FixtureSquad],
    history_by_player: dict[str, list[object]],
) -> list[FixtureSquad]:
    if not history_by_player:
        return squads

    def decorate(player: FixtureSquadPlayer) -> FixtureSquadPlayer:
        return player.model_copy(update={"form_history": history_by_player.get(player.id, [])})

    return [
        squad.model_copy(
            update={
                "players": [decorate(player) for player in squad.players],
                "starters": [decorate(player) for player in squad.starters],
                "bench": [decorate(player) for player in squad.bench],
                "reserves": [decorate(player) for player in squad.reserves],
            }
        )
        for squad in squads
    ]


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
