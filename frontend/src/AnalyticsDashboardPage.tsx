import { type CSSProperties, useEffect, useMemo, useState } from 'react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Select } from './components/ui/select';
import type {
  DashboardClient,
  DashboardConfig,
  DashboardDrilldownResponse,
  DashboardFilterValue,
  DashboardWidgetDefinition,
  WidgetQueryResponse,
} from './dashboard-api';
import { HttpDashboardClient } from './dashboard-api';
import './dashboard.css';

const defaultDashboardClient = new HttpDashboardClient();

interface AnalyticsDashboardPageProps {
  dashboardClient?: DashboardClient;
}

export function AnalyticsDashboardPage({
  dashboardClient = defaultDashboardClient,
}: AnalyticsDashboardPageProps) {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [queries, setQueries] = useState<Record<string, WidgetQueryResponse>>({});
  const [filters, setFilters] = useState<DashboardFilterValue[]>([]);
  const [drilldown, setDrilldown] = useState<DashboardDrilldownResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
      setStatus('loading');
      try {
        const nextConfig = await dashboardClient.getConfig();
        if (!isActive) return;

        const defaultFilters = nextConfig.filters
          .filter((filter) => filter.defaultValue)
          .map((filter) => ({ filterId: filter.id, value: filter.defaultValue ?? '' }));

        setConfig(nextConfig);
        setFilters(defaultFilters);

        const responses = await Promise.all(
          nextConfig.widgets.map((widget) => dashboardClient.queryWidget(widget.id, defaultFilters)),
        );

        if (isActive) {
          setQueries(Object.fromEntries(responses.map((response) => [response.widgetId, response])));
          setStatus('loaded');
        }
      } catch {
        if (isActive) {
          setStatus('error');
        }
      }
    }

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, [dashboardClient]);

  const visibleFilters = useMemo(
    () => config?.filters.filter((filter) => filter.scope === 'global') ?? [],
    [config],
  );

  const updateFilter = async (filterId: string, value: string) => {
    const nextFilters = filters.map((filter) =>
      filter.filterId === filterId ? { ...filter, value } : filter,
    );
    if (!nextFilters.some((filter) => filter.filterId === filterId)) {
      nextFilters.push({ filterId, value });
    }
    setFilters(nextFilters);

    if (!config) return;

    const responses = await Promise.all(
      config.widgets.map((widget) => dashboardClient.queryWidget(widget.id, nextFilters)),
    );
    setQueries(Object.fromEntries(responses.map((response) => [response.widgetId, response])));
  };

  const openDrilldown = async (widget: DashboardWidgetDefinition, pointKey: string | null) => {
    if (!pointKey || !widget.supportsDrilldown) return;
    setDrilldown(await dashboardClient.drilldown(widget.id, pointKey, filters));
  };

  return (
    <main aria-labelledby="dashboard-title" className="feature-screen analytics-dashboard">
      <header>
        <p className="eyebrow">Analytics</p>
        <h1 id="dashboard-title">{config?.title ?? 'Manager Analytics Dashboard'}</h1>
        <p>Explore manager performance through allowlisted metrics, dimensions, and filters.</p>
      </header>

      {status === 'loading' ? <p role="status">Loading dashboard data</p> : null}
      {status === 'error' ? (
        <p role="alert">Unable to load analytics dashboard data from the API.</p>
      ) : null}

      {config ? (
        <>
          <aside aria-label="Dashboard filters" className="dashboard-filters">
            {visibleFilters.map((filter) => (
              <Select
                key={filter.id}
                label={filter.label}
                onChange={(event) => {
                  void updateFilter(filter.id, event.target.value);
                }}
                options={filter.options.map((option) => ({ label: option, value: option }))}
                value={filters.find((value) => value.filterId === filter.id)?.value ?? ''}
              />
            ))}
          </aside>

          <section aria-label="Dashboard widgets" className="dashboard-widget-grid">
            {config.widgets.map((widget) => (
              <DashboardWidget
                key={widget.id}
                onDrilldown={(pointKey) => {
                  void openDrilldown(widget, pointKey);
                }}
                query={queries[widget.id]}
                widget={widget}
              />
            ))}
          </section>
        </>
      ) : null}

      {drilldown ? (
        <section aria-label="Drill-down dialog" className="dashboard-drilldown" role="dialog">
          <header>
            <h2>{drilldown.title}</h2>
            <Button onClick={() => setDrilldown(null)} type="button" variant="ghost">
              Close
            </Button>
          </header>
          <DataTable columns={drilldown.columns} rows={drilldown.rows} />
        </section>
      ) : null}
    </main>
  );
}

function DashboardWidget({
  onDrilldown,
  query,
  widget,
}: {
  onDrilldown: (pointKey: string | null) => void;
  query?: WidgetQueryResponse;
  widget: DashboardWidgetDefinition;
}) {
  return (
    <Card className="dashboard-widget-card">
      <header>
        <p className="eyebrow">{widget.chartType}</p>
        <h2>{widget.title}</h2>
        <p>{widget.description}</p>
      </header>

      {!query ? <p role="status">Loading widget data</p> : null}
      {query?.validationIssues.length ? (
        <ul role="alert">
          {query.validationIssues.map((issue) => (
            <li key={issue.field}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
      {query?.empty ? <p>No data matches the current filters.</p> : null}

      {query && !query.empty && widget.chartType !== 'table' ? (
        <AccessibleChart query={query} onDrilldown={onDrilldown} />
      ) : null}
      {query && !query.empty ? <DataTable columns={query.columns} rows={query.rows} /> : null}
    </Card>
  );
}

function AccessibleChart({
  onDrilldown,
  query,
}: {
  onDrilldown: (pointKey: string | null) => void;
  query: WidgetQueryResponse;
}) {
  const max = Math.max(
    ...query.series.flatMap((series) => series.points.map((point) => point.value)),
    1,
  );

  return (
    <div aria-label={`${query.title} chart`} className="dashboard-chart" role="img">
      {query.series.flatMap((series) =>
        series.points.map((point) => (
          <button
            className="dashboard-chart-bar"
            key={`${series.metricId}-${point.label}`}
            onClick={() => onDrilldown(point.drilldownKey)}
            style={{ '--bar-size': `${Math.max((point.value / max) * 100, 5)}%` } as CSSProperties}
            type="button"
          >
            <span>{point.label}</span>
            <strong>{formatNumber(point.value)}</strong>
          </button>
        )),
      )}
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: WidgetQueryResponse['columns'];
  rows: WidgetQueryResponse['rows'];
}) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.id}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((column) => (
              <td key={column.id}>{row.cells[column.id]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatNumber(value: number): string {
  if (value > 0 && value < 1) {
    return `${Math.round(value * 100)}%`;
  }

  return String(value);
}
