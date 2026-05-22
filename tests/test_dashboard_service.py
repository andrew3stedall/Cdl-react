from cdl_api.contracts.dashboard import DashboardFilterValue, WidgetQueryRequest
from cdl_api.services.dashboard_service import (
    DashboardService,
    MetricCatalogService,
    WidgetQueryService,
)


def test_dashboard_config_exposes_allowlisted_catalog_and_widgets() -> None:
    service = DashboardService()
    config = service.get_config()

    assert config.id == "manager-analytics"
    assert config.gameweek.number == 12
    assert {metric.id for metric in config.metrics} >= {"fantasy_points", "expected_points"}
    assert {dimension.id for dimension in config.dimensions} >= {"cdl_team", "position"}
    assert config.widgets[0].supports_drilldown is True


def test_metric_catalog_lists_filters_metrics_and_dimensions() -> None:
    catalog = MetricCatalogService()

    assert "fantasy_points" in catalog.metric_ids()
    assert "cdl_team" in catalog.dimension_ids()
    assert "gameweek" in catalog.filter_ids()


def test_widget_query_filters_and_returns_chart_and_table_data() -> None:
    dashboard = DashboardService()
    query_service = WidgetQueryService()
    widget = dashboard.get_widget("team-points")

    assert widget is not None

    response = query_service.query_widget(
        widget,
        WidgetQueryRequest(filters=[DashboardFilterValue(filter_id="cdl_team", value="Castle FC")]),
    )

    assert response.widget_id == "team-points"
    assert response.series[0].points[0].label == "Castle FC"
    assert response.rows[0].cells["fantasy_points"] == 74
    assert response.validation_issues == []


def test_widget_query_rejects_unknown_filters() -> None:
    dashboard = DashboardService()
    query_service = WidgetQueryService()
    widget = dashboard.get_widget("team-points")

    assert widget is not None

    response = query_service.query_widget(
        widget,
        WidgetQueryRequest(
            filters=[DashboardFilterValue(filter_id="raw_sql_field", value="points")]
        ),
    )

    assert response.empty is True
    assert response.validation_issues[0].field == "filters.raw_sql_field"


def test_widget_drilldown_preserves_filter_context() -> None:
    from cdl_api.contracts.dashboard import DashboardDrilldownRequest

    dashboard = DashboardService()
    query_service = WidgetQueryService()
    widget = dashboard.get_widget("team-points")

    assert widget is not None

    response = query_service.drilldown(
        widget,
        DashboardDrilldownRequest(
            point_key="castle",
            filters=[DashboardFilterValue(filter_id="gameweek", value="Gameweek 12")],
        ),
    )

    assert response.context["gameweek"] == "Gameweek 12"
    assert response.rows[0].cells["team"] == "Castle FC"
