"""Composite read routes for the canonical manager workspaces."""

from fastapi import APIRouter, Depends

from cdl_api.contracts.squad_workspace import SquadWorkspaceResponse
from cdl_api.routers.squad import get_squad_service
from cdl_api.services.squad import SquadManagementService
from cdl_api.services.squad_workspace import SquadWorkspaceService

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
