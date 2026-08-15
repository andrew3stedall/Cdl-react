"""Composite read routes for the canonical manager workspaces."""

from fastapi import APIRouter, Depends

from cdl_api.contracts.manager_desk import ManagerDeskResponse
from cdl_api.contracts.squad_workspace import SquadWorkspaceResponse
from cdl_api.routers.league import get_league_repository
from cdl_api.routers.squad import get_squad_service
from cdl_api.routers.team_selection import get_team_selection_service
from cdl_api.services.league_service import LeagueReadRepository
from cdl_api.services.manager_desk import ManagerDeskService
from cdl_api.services.squad import SquadManagementService
from cdl_api.services.squad_workspace import SquadWorkspaceService
from cdl_api.services.team_selection import TeamSelectionService

router = APIRouter(tags=["workspace"])


def get_squad_workspace_service(
    squad_service: SquadManagementService = Depends(get_squad_service),
) -> SquadWorkspaceService:
    return SquadWorkspaceService(squad_service)


@router.get("/squad/workspace", response_model=SquadWorkspaceResponse)
def squad_workspace(
    service: SquadWorkspaceService = Depends(get_squad_workspace_service),
) -> SquadWorkspaceResponse:
    return service.get_workspace()


def get_manager_desk_service(
    team_selection_service: TeamSelectionService = Depends(get_team_selection_service),
    squad_service: SquadManagementService = Depends(get_squad_service),
    league_repository: LeagueReadRepository = Depends(get_league_repository),
) -> ManagerDeskService:
    return ManagerDeskService(team_selection_service, squad_service, league_repository)


@router.get("/desk", response_model=ManagerDeskResponse)
def manager_desk(
    service: ManagerDeskService = Depends(get_manager_desk_service),
) -> ManagerDeskResponse:
    return service.get_desk()
