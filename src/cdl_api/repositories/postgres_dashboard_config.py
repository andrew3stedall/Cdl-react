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
from cdl_api.services.dashboard_service import DashboardService


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
        return DashboardConfigResponse.model_validate(payload)

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
