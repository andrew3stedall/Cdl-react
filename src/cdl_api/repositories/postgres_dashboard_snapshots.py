"""PostgreSQL-backed dashboard aggregate snapshot reads."""

from collections.abc import Callable, Mapping

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.dashboard import (
    ChartDataPoint,
    DashboardTableColumn,
    DashboardTableRow,
    DashboardWidgetDefinition,
)
from cdl_api.repositories.postgres_dashboard_fdr import dashboard_aggregate_snapshots_table


class PostgreSQLDashboardSnapshotRepository:
    """Read widget result points only from persisted aggregate snapshots."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def aggregate_widget(
        self,
        widget: DashboardWidgetDefinition,
        filters: dict[str, str],
    ) -> list[ChartDataPoint]:
        with self._session_factory() as session:
            rows = session.execute(
                select(
                    dashboard_aggregate_snapshots_table.c.id,
                    dashboard_aggregate_snapshots_table.c.payload_json,
                ).order_by(dashboard_aggregate_snapshots_table.c.id)
            ).mappings()

            points: list[ChartDataPoint] = []
            for row in rows:
                payload = row["payload_json"]
                if not isinstance(payload, Mapping):
                    raise ValueError("Dashboard aggregate payload must be a JSON object.")
                if payload.get("widget_id") != widget.id:
                    continue
                if payload.get("metric_id") != widget.metric_id:
                    continue
                if payload.get("dimension_id") != widget.dimension_id:
                    continue
                if not self._matches_filters(payload, widget, filters):
                    continue
                points.append(
                    ChartDataPoint(
                        label=str(payload["label"]),
                        value=float(payload["metric_value"]),
                        dimension_value=str(payload["dimension_value"]),
                        drilldown_key=(
                            str(payload["drilldown_key"])
                            if payload.get("drilldown_key") is not None
                            else None
                        ),
                    )
                )
            return points

    @staticmethod
    def _matches_filters(
        payload: Mapping[str, object],
        widget: DashboardWidgetDefinition,
        filters: dict[str, str],
    ) -> bool:
        selected_dimension = filters.get(widget.dimension_id)
        if selected_dimension and not selected_dimension.startswith("All "):
            if str(payload.get("dimension_value")) != selected_dimension:
                return False

        selected_gameweek = filters.get("gameweek")
        if selected_gameweek and str(payload.get("gameweek")) != selected_gameweek:
            return False
        return True

    def list_table_columns(
        self,
        widget: DashboardWidgetDefinition,
    ) -> list[DashboardTableColumn]:
        return [
            DashboardTableColumn(
                id=widget.dimension_id,
                label=widget.title.replace(" table", ""),
            ),
            DashboardTableColumn(
                id=widget.metric_id,
                label=widget.metric_id.replace("_", " ").title(),
                align="right",
            ),
        ]

    def list_table_rows(
        self,
        widget: DashboardWidgetDefinition,
        points: list[ChartDataPoint],
    ) -> list[DashboardTableRow]:
        return [
            DashboardTableRow(
                cells={widget.dimension_id: point.label, widget.metric_id: point.value}
            )
            for point in points
        ]

    def drilldown_rows(
        self,
        widget: DashboardWidgetDefinition,
        point_key: str,
    ) -> list[DashboardTableRow]:
        """Drill-down facts are not part of aggregate snapshots."""
        return []

    def seed_synthetic_data(self) -> None:
        """Idempotently insert deterministic, explicitly synthetic query snapshots."""
        snapshots = (
            (
                "team-points-castle-gw12",
                {
                    "dashboard_id": "manager-analytics",
                    "widget_id": "team-points",
                    "metric_id": "fantasy_points",
                    "dimension_id": "cdl_team",
                    "dimension_value": "Castle FC",
                    "label": "Castle FC",
                    "gameweek": "Gameweek 12",
                    "metric_value": 74,
                    "drilldown_key": "castle",
                    "synthetic": True,
                },
            ),
            (
                "team-points-drafton-gw12",
                {
                    "dashboard_id": "manager-analytics",
                    "widget_id": "team-points",
                    "metric_id": "fantasy_points",
                    "dimension_id": "cdl_team",
                    "dimension_value": "Drafton",
                    "label": "Drafton",
                    "gameweek": "Gameweek 12",
                    "metric_value": 66,
                    "drilldown_key": "drafton",
                    "synthetic": True,
                },
            ),
        )
        with self._session_factory() as session:
            existing_ids = {
                str(row[0])
                for row in session.execute(
                    select(dashboard_aggregate_snapshots_table.c.id)
                )
            }
            for snapshot_id, payload in snapshots:
                if snapshot_id in existing_ids:
                    continue
                session.execute(
                    insert(dashboard_aggregate_snapshots_table).values(
                        id=snapshot_id,
                        payload_json=payload,
                    )
                )
            session.commit()
