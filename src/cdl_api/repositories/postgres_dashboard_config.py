"""PostgreSQL-backed dashboard configuration reads."""

from collections.abc import Callable, Mapping

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.dashboard import (
    DashboardConfigResponse,
    DashboardDimension,
    DashboardFilter,
    DashboardWidgetDefinition,
)
from cdl_api.repositories.dashboard_repository import DashboardRepository
from cdl_api.repositories.postgres_dashboard_fdr import dashboard_definitions_table
from cdl_api.repositories.postgres_league_fpl import draft_teams_table
from cdl_api.services.dashboard_service import DashboardService
from cdl_api.staging_draft_seed import LEAGUE_ID


class PostgreSQLDashboardConfigRepository:
    """Read dashboard configuration from migration 0007 payload rows."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_config(self) -> DashboardConfigResponse | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(
                        dashboard_definitions_table.c.id,
                        dashboard_definitions_table.c.payload_json,
                    ).order_by(dashboard_definitions_table.c.id)
                )
                .mappings()
                .first()
            )

        if row is None or not isinstance(row["payload_json"], Mapping):
            return None
        payload = dict(row["payload_json"])
        payload["id"] = str(row["id"])
        config = DashboardConfigResponse.model_validate(payload)
        with self._session_factory() as session:
            team_names = list(
                session.execute(
                    select(draft_teams_table.c.name)
                    .where(draft_teams_table.c.league_id == LEAGUE_ID)
                    .order_by(draft_teams_table.c.name)
                ).scalars()
            )
        if not team_names:
            return config
        dimensions = [
            dimension.model_copy(update={"values": team_names})
            if dimension.id == "cdl_team"
            else dimension
            for dimension in config.dimensions
        ]
        filters = [
            filter_definition.model_copy(
                update={"options": ["All teams", *team_names], "default_value": "All teams"}
            )
            if filter_definition.id == "cdl_team"
            else filter_definition
            for filter_definition in config.filters
        ]
        return config.model_copy(update={"dimensions": dimensions, "filters": filters})

    def get_widget(self, widget_id: str) -> DashboardWidgetDefinition | None:
        """Resolve a widget only from the persisted dashboard definition."""
        config = self.get_config()
        if config is None:
            return None
        return next((widget for widget in config.widgets if widget.id == widget_id), None)

    def list_filters(self) -> list[DashboardFilter]:
        config = self.get_config()
        return [] if config is None else config.filters

    def list_dimensions(self) -> list[DashboardDimension]:
        config = self.get_config()
        return [] if config is None else config.dimensions

    def seed_synthetic_data(self) -> None:
        """Idempotently insert one deterministic, explicitly synthetic test config."""
        config = DashboardService(DashboardRepository()).get_config()
        payload = config.model_dump(mode="json")
        payload["synthetic"] = True

        with self._session_factory() as session:
            exists = session.execute(
                select(dashboard_definitions_table.c.id).where(
                    dashboard_definitions_table.c.id == config.id
                )
            ).first()
            if exists is None:
                session.execute(
                    insert(dashboard_definitions_table).values(
                        id=config.id,
                        payload_json=payload,
                    )
                )
                session.commit()
