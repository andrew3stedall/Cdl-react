"""PostgreSQL-backed dashboard metric catalog reads."""

from collections.abc import Callable, Mapping

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.dashboard import DashboardMetric
from cdl_api.repositories.postgres_dashboard_fdr import dashboard_metric_catalog_table


class PostgreSQLDashboardMetricRepository:
    """Read dashboard metric definitions from the migrated payload table."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def list_metrics(self) -> list[DashboardMetric]:
        with self._session_factory() as session:
            rows = session.execute(
                select(
                    dashboard_metric_catalog_table.c.id,
                    dashboard_metric_catalog_table.c.payload_json,
                ).order_by(dashboard_metric_catalog_table.c.id)
            ).mappings()
            metrics = []
            for row in rows:
                payload = row["payload_json"]
                if not isinstance(payload, Mapping):
                    raise ValueError("Dashboard metric payload must be a JSON object.")
                metrics.append(
                    DashboardMetric.model_validate(
                        {
                            **dict(payload),
                            "id": str(row["id"]),
                        }
                    )
                )
            return metrics

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
                        payload_json=metric.model_dump(mode="json"),
                    )
                )
            session.commit()
