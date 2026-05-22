"""Analytics dashboard API routes."""

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from cdl_api.contracts.common import ApiErrorResponse, ErrorCode
from cdl_api.contracts.dashboard import (
    DashboardConfigResponse,
    DashboardDimension,
    DashboardDrilldownRequest,
    DashboardDrilldownResponse,
    DashboardFilter,
    DashboardMetric,
    WidgetQueryRequest,
    WidgetQueryResponse,
)
from cdl_api.services.dashboard_service import (
    DashboardService,
    MetricCatalogService,
    WidgetQueryService,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_dashboard_service = DashboardService()
_catalog_service = MetricCatalogService()
_query_service = WidgetQueryService()


@router.get("/config", response_model=DashboardConfigResponse)
def dashboard_config() -> DashboardConfigResponse:
    return _dashboard_service.get_config()


@router.get("/filters", response_model=list[DashboardFilter])
def dashboard_filters() -> list[DashboardFilter]:
    return _catalog_service.list_filters()


@router.get("/metrics", response_model=list[DashboardMetric])
def dashboard_metrics() -> list[DashboardMetric]:
    return _catalog_service.list_metrics()


@router.get("/dimensions", response_model=list[DashboardDimension])
def dashboard_dimensions() -> list[DashboardDimension]:
    return _catalog_service.list_dimensions()


@router.post(
    "/widgets/{widget_id}/query",
    response_model=WidgetQueryResponse,
    responses={status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse}},
)
def dashboard_widget_query(
    widget_id: str,
    request: WidgetQueryRequest,
) -> WidgetQueryResponse | JSONResponse:
    widget = _dashboard_service.get_widget(widget_id)
    if widget is None:
        return _not_found(widget_id)

    return _query_service.query_widget(widget, request)


@router.post(
    "/widgets/{widget_id}/drilldown",
    response_model=DashboardDrilldownResponse,
    responses={status.HTTP_404_NOT_FOUND: {"model": ApiErrorResponse}},
)
def dashboard_widget_drilldown(
    widget_id: str,
    request: DashboardDrilldownRequest,
) -> DashboardDrilldownResponse | JSONResponse:
    widget = _dashboard_service.get_widget(widget_id)
    if widget is None:
        return _not_found(widget_id)

    return _query_service.drilldown(widget, request)


def _not_found(widget_id: str) -> JSONResponse:
    error = ApiErrorResponse(
        code=ErrorCode.NOT_FOUND,
        message="Dashboard widget not found.",
        details={"widget_id": widget_id},
    )
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=error.model_dump(mode="json"),
    )
