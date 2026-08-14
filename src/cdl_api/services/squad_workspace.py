"""Application service for the combined Squad workspace read model."""

from cdl_api.contracts.squad_workspace import SquadWorkspaceResponse
from cdl_api.services.squad import SquadManagementService


class SquadWorkspaceService:
    """Compose the initial Squad read model without changing command APIs."""

    def __init__(
        self,
        squad_service: SquadManagementService,
    ) -> None:
        self._squad_service = squad_service

    def get_workspace(self) -> SquadWorkspaceResponse:
        return SquadWorkspaceResponse(
            summary=self._squad_service.get_summary(),
            notifications=self._squad_service.notifications(),
        )
