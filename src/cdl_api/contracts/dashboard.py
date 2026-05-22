"""Analytics dashboard contracts."""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from cdl_api.contracts.common import ValidationIssue
from cdl_api.contracts.domain import GameweekSummary


class DashboardAggregation(StrEnum):
    SUM = "sum"
    AVG = "avg"
    COUNT = "count"
    MAX = "max"
    MIN = "min"


class DashboardChartType(StrEnum):
    BAR = "bar"
    LINE = "line"
    TABLE = "table"
    KPI = "kpi"


class DashboardFilterScope(StrEnum):
    GLOBAL = "global"
    WIDGET = "widget"


class DashboardMetric(BaseModel):
    id: str
    label: str
    description: str
    aggregation: DashboardAggregation
    format: Literal["number", "points", "percentage"] = "number"


class DashboardDimension(BaseModel):
    id: str
    label: str
    description: str
    values: list[str] = Field(default_factory=list)


class DashboardFilter(BaseModel):
    id: str
    label: str
    dimension_id: str
    scope: DashboardFilterScope = DashboardFilterScope.GLOBAL
    options: list[str] = Field(default_factory=list)
    default_value: str | None = None


class DashboardWidgetDefinition(BaseModel):
    id: str
    title: str
    description: str
    chart_type: DashboardChartType
    metric_id: str
    dimension_id: str
    filter_ids: list[str] = Field(default_factory=list)
    supports_drilldown: bool = False
    sort: Literal["asc", "desc"] = "desc"


class DashboardConfigResponse(BaseModel):
    id: str
    title: str
    gameweek: GameweekSummary
    widgets: list[DashboardWidgetDefinition]
    filters: list[DashboardFilter]
    metrics: list[DashboardMetric]
    dimensions: list[DashboardDimension]


class DashboardFilterValue(BaseModel):
    filter_id: str
    value: str


class WidgetQueryRequest(BaseModel):
    filters: list[DashboardFilterValue] = Field(default_factory=list)
    drilldown_dimension_id: str | None = None
    limit: int = Field(default=10, ge=1, le=50)


class ChartDataPoint(BaseModel):
    label: str
    value: float
    dimension_value: str
    drilldown_key: str | None = None


class ChartSeries(BaseModel):
    metric_id: str
    label: str
    points: list[ChartDataPoint]


class DashboardTableColumn(BaseModel):
    id: str
    label: str
    align: Literal["left", "right"] = "left"


class DashboardTableRow(BaseModel):
    cells: dict[str, str | int | float]


class WidgetQueryResponse(BaseModel):
    widget_id: str
    chart_type: DashboardChartType
    title: str
    series: list[ChartSeries] = Field(default_factory=list)
    columns: list[DashboardTableColumn] = Field(default_factory=list)
    rows: list[DashboardTableRow] = Field(default_factory=list)
    filters_applied: list[DashboardFilterValue] = Field(default_factory=list)
    validation_issues: list[ValidationIssue] = Field(default_factory=list)
    empty: bool = False
    partial: bool = False


class DashboardDrilldownRequest(BaseModel):
    filters: list[DashboardFilterValue] = Field(default_factory=list)
    point_key: str


class DashboardDrilldownResponse(BaseModel):
    widget_id: str
    title: str
    context: dict[str, str]
    columns: list[DashboardTableColumn]
    rows: list[DashboardTableRow]
