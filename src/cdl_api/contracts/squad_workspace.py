"""Combined read contract for the canonical Squad workspace."""

from pydantic import BaseModel

from cdl_api.contracts.squad import (
    SquadNotificationsResponse,
    SquadSummaryResponse,
)


class SquadWorkspaceResponse(BaseModel):
    """Data required to render the initial Squad workspace."""

    summary: SquadSummaryResponse
    notifications: SquadNotificationsResponse
