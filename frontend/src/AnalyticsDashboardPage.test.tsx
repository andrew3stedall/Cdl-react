import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { AnalyticsDashboardPage } from './AnalyticsDashboardPage';
import type {
  DashboardClient,
  DashboardConfig,
  DashboardDrilldownResponse,
  DashboardFilterValue,
  WidgetQueryResponse,
} from './dashboard-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const config: DashboardConfig = {
  id: 'manager-analytics',
  title: 'Manager Analytics Dashboard',
  gameweek: { id: 'gw-12', name: 'Gameweek 12', number: 12 },
  filters: [
    {
      id: 'gameweek',
      label: 'Gameweek',
      dimensionId: 'gameweek',
      scope: 'global',
      options: ['Gameweek 12', 'Gameweek 11'],
      defaultValue: 'Gameweek 12',
    },
  ],
  metrics: [
    {
      id: 'fantasy_points',
      label: 'Fantasy points',
      description: 'Total points',
      aggregation: 'sum',
      format: 'points',
    },
  ],
  dimensions: [
    {
      id: 'cdl_team',
      label: 'CDL team',
      description: 'Manager team',
      values: ['Castle FC'],
    },
  ],
  widgets: [
    {
      id: 'team-points',
      title: 'Points by CDL team',
      description: 'Total fantasy points by manager team.',
      chartType: 'bar',
      metricId: 'fantasy_points',
      dimensionId: 'cdl_team',
      filterIds: ['gameweek'],
      supportsDrilldown: true,
      sort: 'desc',
    },
  ],
};

class MemoryDashboardClient implements DashboardClient {
  queryCount = 0;

  async getConfig(): Promise<DashboardConfig> {
    return config;
  }

  async queryWidget(
    _widgetId: string,
    filters: DashboardFilterValue[],
  ): Promise<WidgetQueryResponse> {
    this.queryCount += 1;
    return {
      widgetId: 'team-points',
      chartType: 'bar',
      title: 'Points by CDL team',
      series: [
        {
          metricId: 'fantasy_points',
          label: 'Points by CDL team',
          points: [
            {
              label: filters[0]?.value === 'Gameweek 11' ? 'Drafton' : 'Castle FC',
              value: filters[0]?.value === 'Gameweek 11' ? 66 : 74,
              dimensionValue: 'Castle FC',
              drilldownKey: 'castle',
            },
          ],
        },
      ],
      columns: [
        { id: 'cdl_team', label: 'CDL team', align: 'left' },
        { id: 'fantasy_points', label: 'Fantasy Points', align: 'right' },
      ],
      rows: [
        {
          cells: {
            cdl_team: filters[0]?.value === 'Gameweek 11' ? 'Drafton' : 'Castle FC',
            fantasy_points: filters[0]?.value === 'Gameweek 11' ? 66 : 74,
          },
        },
      ],
      filtersApplied: filters,
      validationIssues: [],
      empty: false,
      partial: false,
    };
  }

  async drilldown(): Promise<DashboardDrilldownResponse> {
    return {
      widgetId: 'team-points',
      title: 'Points by CDL team drill-down',
      context: { gameweek: 'Gameweek 12' },
      columns: [
        { id: 'player', label: 'Player', align: 'left' },
        { id: 'points', label: 'Points', align: 'right' },
      ],
      rows: [{ cells: { player: 'Casey Midfielder', points: 14 } }],
    };
  }
}

async function renderPage(client = new MemoryDashboardClient()) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<AnalyticsDashboardPage dashboardClient={client} />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return { client, container, root };
}

describe('AnalyticsDashboardPage', () => {
  test('renders dashboard filters, chart fallback table, and widget data', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Manager Analytics Dashboard');
    expect(container.textContent).toContain('Gameweek');
    expect(container.textContent).toContain('Points by CDL team');
    expect(container.textContent).toContain('Castle FC');
    expect(container.textContent).toContain('74');
  });

  test('requeries widgets when a global filter changes', async () => {
    const { client, container } = await renderPage();
    const select = container.querySelector('select') as HTMLSelectElement;

    await act(async () => {
      select.value = 'Gameweek 11';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(client.queryCount).toBeGreaterThan(1);
    expect(container.textContent).toContain('Drafton');
  });

  test('opens drill-down dialog from chart point', async () => {
    const { container } = await renderPage();
    const pointButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Castle FC'),
    ) as HTMLButtonElement;

    await act(async () => {
      pointButton.click();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Casey Midfielder');
  });
});
