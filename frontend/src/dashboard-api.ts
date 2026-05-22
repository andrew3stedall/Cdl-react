export type DashboardChartType = 'bar' | 'line' | 'table' | 'kpi';
export type DashboardFilterScope = 'global' | 'widget';

export interface DashboardMetric {
  id: string;
  label: string;
  description: string;
  aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min';
  format: 'number' | 'points' | 'percentage';
}

export interface DashboardDimension {
  id: string;
  label: string;
  description: string;
  values: string[];
}

export interface DashboardFilter {
  id: string;
  label: string;
  dimensionId: string;
  scope: DashboardFilterScope;
  options: string[];
  defaultValue: string | null;
}

export interface DashboardWidgetDefinition {
  id: string;
  title: string;
  description: string;
  chartType: DashboardChartType;
  metricId: string;
  dimensionId: string;
  filterIds: string[];
  supportsDrilldown: boolean;
  sort: 'asc' | 'desc';
}

export interface DashboardConfig {
  id: string;
  title: string;
  gameweek: { id: string; name: string; number: number };
  widgets: DashboardWidgetDefinition[];
  filters: DashboardFilter[];
  metrics: DashboardMetric[];
  dimensions: DashboardDimension[];
}

export interface DashboardFilterValue {
  filterId: string;
  value: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  dimensionValue: string;
  drilldownKey: string | null;
}

export interface ChartSeries {
  metricId: string;
  label: string;
  points: ChartDataPoint[];
}

export interface DashboardTableColumn {
  id: string;
  label: string;
  align: 'left' | 'right';
}

export interface DashboardTableRow {
  cells: Record<string, string | number>;
}

export interface WidgetQueryResponse {
  widgetId: string;
  chartType: DashboardChartType;
  title: string;
  series: ChartSeries[];
  columns: DashboardTableColumn[];
  rows: DashboardTableRow[];
  filtersApplied: DashboardFilterValue[];
  validationIssues: { field: string; message: string; ruleReference: string | null }[];
  empty: boolean;
  partial: boolean;
}

export interface DashboardDrilldownResponse {
  widgetId: string;
  title: string;
  context: Record<string, string>;
  columns: DashboardTableColumn[];
  rows: DashboardTableRow[];
}

export interface DashboardClient {
  getConfig(): Promise<DashboardConfig>;
  queryWidget(widgetId: string, filters: DashboardFilterValue[]): Promise<WidgetQueryResponse>;
  drilldown(
    widgetId: string,
    pointKey: string,
    filters: DashboardFilterValue[],
  ): Promise<DashboardDrilldownResponse>;
}

interface ApiDashboardFilter {
  id: string;
  label: string;
  dimension_id: string;
  scope: DashboardFilterScope;
  options: string[];
  default_value: string | null;
}

interface ApiWidget {
  id: string;
  title: string;
  description: string;
  chart_type: DashboardChartType;
  metric_id: string;
  dimension_id: string;
  filter_ids: string[];
  supports_drilldown: boolean;
  sort: 'asc' | 'desc';
}

interface ApiDashboardConfig {
  id: string;
  title: string;
  gameweek: DashboardConfig['gameweek'];
  widgets: ApiWidget[];
  filters: ApiDashboardFilter[];
  metrics: DashboardMetric[];
  dimensions: DashboardDimension[];
}

interface ApiFilterValue {
  filter_id: string;
  value: string;
}

interface ApiPoint {
  label: string;
  value: number;
  dimension_value: string;
  drilldown_key: string | null;
}

interface ApiSeries {
  metric_id: string;
  label: string;
  points: ApiPoint[];
}

interface ApiColumn {
  id: string;
  label: string;
  align: 'left' | 'right';
}

interface ApiRow {
  cells: Record<string, string | number>;
}

interface ApiWidgetQueryResponse {
  widget_id: string;
  chart_type: DashboardChartType;
  title: string;
  series: ApiSeries[];
  columns: ApiColumn[];
  rows: ApiRow[];
  filters_applied: ApiFilterValue[];
  validation_issues: { field: string; message: string; rule_reference: string | null }[];
  empty: boolean;
  partial: boolean;
}

interface ApiDrilldownResponse {
  widget_id: string;
  title: string;
  context: Record<string, string>;
  columns: ApiColumn[];
  rows: ApiRow[];
}

export class HttpDashboardClient implements DashboardClient {
  constructor(private readonly baseUrl = '/api') {}

  async getConfig(): Promise<DashboardConfig> {
    return mapConfig(await this.get<ApiDashboardConfig>('/dashboard/config'));
  }

  async queryWidget(widgetId: string, filters: DashboardFilterValue[]): Promise<WidgetQueryResponse> {
    return mapWidgetResponse(
      await this.post<ApiWidgetQueryResponse>(`/dashboard/widgets/${widgetId}/query`, {
        filters: filters.map(mapFilterToApi),
      }),
    );
  }

  async drilldown(
    widgetId: string,
    pointKey: string,
    filters: DashboardFilterValue[],
  ): Promise<DashboardDrilldownResponse> {
    const response = await this.post<ApiDrilldownResponse>(`/dashboard/widgets/${widgetId}/drilldown`, {
      point_key: pointKey,
      filters: filters.map(mapFilterToApi),
    });
    return {
      widgetId: response.widget_id,
      title: response.title,
      context: response.context,
      columns: response.columns,
      rows: response.rows,
    };
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Unable to load dashboard data from ${path}.`);
    }
    return (await response.json()) as T;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      body: JSON.stringify(body),
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Unable to submit dashboard request to ${path}.`);
    }
    return (await response.json()) as T;
  }
}

function mapFilterToApi(filter: DashboardFilterValue): ApiFilterValue {
  return { filter_id: filter.filterId, value: filter.value };
}

function mapFilter(filter: ApiDashboardFilter): DashboardFilter {
  return {
    id: filter.id,
    label: filter.label,
    dimensionId: filter.dimension_id,
    scope: filter.scope,
    options: filter.options,
    defaultValue: filter.default_value,
  };
}

function mapWidget(widget: ApiWidget): DashboardWidgetDefinition {
  return {
    id: widget.id,
    title: widget.title,
    description: widget.description,
    chartType: widget.chart_type,
    metricId: widget.metric_id,
    dimensionId: widget.dimension_id,
    filterIds: widget.filter_ids,
    supportsDrilldown: widget.supports_drilldown,
    sort: widget.sort,
  };
}

function mapConfig(config: ApiDashboardConfig): DashboardConfig {
  return {
    ...config,
    filters: config.filters.map(mapFilter),
    widgets: config.widgets.map(mapWidget),
  };
}

function mapPoint(point: ApiPoint): ChartDataPoint {
  return {
    label: point.label,
    value: point.value,
    dimensionValue: point.dimension_value,
    drilldownKey: point.drilldown_key,
  };
}

function mapWidgetResponse(response: ApiWidgetQueryResponse): WidgetQueryResponse {
  return {
    widgetId: response.widget_id,
    chartType: response.chart_type,
    title: response.title,
    series: response.series.map((series) => ({
      metricId: series.metric_id,
      label: series.label,
      points: series.points.map(mapPoint),
    })),
    columns: response.columns,
    rows: response.rows,
    filtersApplied: response.filters_applied.map((filter) => ({
      filterId: filter.filter_id,
      value: filter.value,
    })),
    validationIssues: response.validation_issues.map((issue) => ({
      field: issue.field,
      message: issue.message,
      ruleReference: issue.rule_reference,
    })),
    empty: response.empty,
    partial: response.partial,
  };
}
