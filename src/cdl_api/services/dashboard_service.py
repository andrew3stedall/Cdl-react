"""Analytics dashboard service layer."""

from cdl_api.contracts.common import ValidationIssue
from cdl_api.contracts.dashboard import (
    ChartSeries,
    DashboardConfigResponse,
    DashboardDimension,
    DashboardDrilldownRequest,
    DashboardDrilldownResponse,
    DashboardFilter,
    DashboardFilterValue,
    DashboardMetric,
    DashboardTableColumn,
    DashboardWidgetDefinition,
    WidgetQueryRequest,
    WidgetQueryResponse,
)
from cdl_api.repositories.dashboard_repository import DashboardRepository


class MetricCatalogService:
    def __init__(self, repository: DashboardRepository | None = None) -> None:
        self._repository = repository or DashboardRepository()

    def list_metrics(self) -> list[DashboardMetric]:
        return self._repository.list_metrics()

    def list_dimensions(self) -> list[DashboardDimension]:
        return self._repository.list_dimensions()

    def list_filters(self) -> list[DashboardFilter]:
        return self._repository.list_filters()

    def metric_ids(self) -> set[str]:
        return {metric.id for metric in self.list_metrics()}

    def dimension_ids(self) -> set[str]:
        return {dimension.id for dimension in self.list_dimensions()}

    def filter_ids(self) -> set[str]:
        return {filter_definition.id for filter_definition in self.list_filters()}


class DashboardService:
    def __init__(
        self,
        repository: DashboardRepository | None = None,
        catalog: MetricCatalogService | None = None,
    ) -> None:
        self._repository = repository or DashboardRepository()
        self._catalog = catalog or MetricCatalogService(self._repository)

    def get_config(self) -> DashboardConfigResponse:
        return DashboardConfigResponse(
            id="manager-analytics",
            title="Manager Analytics Dashboard",
            gameweek=self._repository.get_gameweek(),
            widgets=self._repository.list_widgets(),
            filters=self._repository.list_filters(),
            metrics=self._repository.list_metrics(),
            dimensions=self._repository.list_dimensions(),
        )

    def get_widget(self, widget_id: str) -> DashboardWidgetDefinition | None:
        return next(
            (widget for widget in self._repository.list_widgets() if widget.id == widget_id),
            None,
        )


class WidgetQueryService:
    def __init__(
        self,
        repository: DashboardRepository | None = None,
        catalog: MetricCatalogService | None = None,
    ) -> None:
        self._repository = repository or DashboardRepository()
        self._catalog = catalog or MetricCatalogService(self._repository)

    def query_widget(
        self,
        widget: DashboardWidgetDefinition,
        request: WidgetQueryRequest,
    ) -> WidgetQueryResponse:
        issues = self._validate(widget, request.filters)
        if issues:
            return WidgetQueryResponse(
                widget_id=widget.id,
                chart_type=widget.chart_type,
                title=widget.title,
                filters_applied=request.filters,
                validation_issues=issues,
                empty=True,
            )

        applied_filters = {
            filter_value.filter_id: filter_value.value for filter_value in request.filters
        }
        points = self._repository.aggregate_widget(widget, applied_filters)[: request.limit]
        columns = self._repository.list_table_columns(widget)
        rows = self._repository.list_table_rows(widget, points)

        return WidgetQueryResponse(
            widget_id=widget.id,
            chart_type=widget.chart_type,
            title=widget.title,
            series=[ChartSeries(metric_id=widget.metric_id, label=widget.title, points=points)],
            columns=columns,
            rows=rows,
            filters_applied=request.filters,
            empty=len(points) == 0,
            partial=len(points) == request.limit,
        )

    def drilldown(
        self,
        widget: DashboardWidgetDefinition,
        request: DashboardDrilldownRequest,
    ) -> DashboardDrilldownResponse:
        return DashboardDrilldownResponse(
            widget_id=widget.id,
            title=f"{widget.title} drill-down",
            context={
                filter_value.filter_id: filter_value.value for filter_value in request.filters
            },
            columns=[
                DashboardTableColumn(id="player", label="Player"),
                DashboardTableColumn(id="team", label="Team"),
                DashboardTableColumn(id="points", label="Points", align="right"),
            ],
            rows=self._repository.drilldown_rows(widget, request.point_key),
        )

    def _validate(
        self,
        widget: DashboardWidgetDefinition,
        filters: list[DashboardFilterValue],
    ) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        if widget.metric_id not in self._catalog.metric_ids():
            issues.append(
                ValidationIssue(
                    field="metric_id",
                    message="Widget references a metric outside the server allowlist.",
                    rule_reference="metric-catalog",
                )
            )

        if widget.dimension_id not in self._catalog.dimension_ids():
            issues.append(
                ValidationIssue(
                    field="dimension_id",
                    message="Widget references a dimension outside the server allowlist.",
                    rule_reference="metric-catalog",
                )
            )

        allowed_filter_ids = self._catalog.filter_ids()
        for filter_value in filters:
            if filter_value.filter_id not in allowed_filter_ids:
                issues.append(
                    ValidationIssue(
                        field=f"filters.{filter_value.filter_id}",
                        message="Filter is not available in the dashboard allowlist.",
                        rule_reference="dashboard-filters",
                    )
                )

        return issues
