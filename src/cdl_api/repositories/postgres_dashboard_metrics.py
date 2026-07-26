"""PostgreSQL-backed dashboard metric catalog reads."""

from collections.abc import Callable

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.dashboard import DashboardMetric
from cdl_api.repositories.postgres_dashboard_fdr import dashboard_metric_catalog_table


class PostgreSQLDashboardMetricRepository:
    """Read dashboard metric definitions from the migrated catalog table."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def list_metrics(self) -> list[DashboardMetric]:
        with self._session_factory() as session:
            rows = session.execute(
                select(dashboard_metric_catalog_table).order_by(dashboard_metric_catalog_table.c.id)
            ).mappings()
            return [DashboardMetric.model_validate(dict(row)) for row in rows]

    def seed_synthetic_data(self) -> None:
        """Idempotently insert deterministic, explicitly synthetic test metrics."""
        metrics = (
            DashboardMetric(
                id="fantasy_points",
                label="Fantasy points",
                description="Synthetic total fantasy points for release-path testing.",
                aggregation="sum",
                format="points",
            ),
            DashboardMetric(
                id="expected_points",
                label="Expected points",
                description="Synthetic expected-points metric for release-path testing.",
                aggregation="avg",
                format="points",
            ),
        )
        with self._session_factory() as session:
            existing_ids = {
                str(row[0]) for row in session.execute(select(dashboard_metric_catalog_table.c.id))
            }
            for metric in metrics:
                if metric.id in existing_ids:
                    continue
                session.execute(
                    insert(dashboard_metric_catalog_table).values(
                        id=metric.id,
                        label=metric.label,
                        aggregation=metric.aggregation.value,
                        format=metric.format,
                        description=metric.description,
                    )
                )
            session.commit()
