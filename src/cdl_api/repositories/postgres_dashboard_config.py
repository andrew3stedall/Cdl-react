"""PostgreSQL-backed dashboard configuration reads."""

from collections.abc import Callable, Mapping

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.dashboard import DashboardConfigResponse
from cdl_api.repositories.dashboard_repository import DashboardRepository
from cdl_api.repositories.postgres_dashboard_fdr import dashboard_definitions_table
from cdl_api.services.dashboard_service import DashboardService


class PostgreSQLDashboardConfigRepository:
    """Read dashboard configuration from migration 0007 payload rows."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def get_config(self) -> DashboardConfigResponse | None:
        with self._session_factory() as session:
            row = session.execute(
                select(
                    dashboard_definitions_table.c.id,
                    dashboard_definitions_table.c.payload_json,
                ).order_by(dashboard_definitions_table.c.id)
            ).mappings().first()

        if row is None or not isinstance(row["payload_json"], Mapping):
            return None
        payload = dict(row["payload_json"])
        payload["id"] = str(row["id"])
        return DashboardConfigResponse.model_validate(payload)

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
