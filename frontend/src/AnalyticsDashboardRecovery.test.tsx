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
      id: 'team-filter',
      label: 'Team',
      dimensionId: 'team',
      scope: 'global',
      options: ['All', 'Castle FC', 'River Rangers'],
      defaultValue: 'All',
    },
  ],
  metrics: [],
  dimensions: [],
  widgets: [
    {
      id: 'points-by-team',
      title: 'Points by team',
      description: 'Current gameweek scoring snapshot.',
      chartType: 'bar',
      metricId: 'points',
      dimensionId: 'team',
      filterIds: ['team-filter'],
      supportsDrilldown: false,
      sort: 'desc',
    },
  ],
};

class RecoveringDashboardClient implements DashboardClient {
  failNextQuery = false;
  queryFilters: DashboardFilterValue[][] = [];

  async getConfig(): Promise<DashboardConfig> {
    return config;
  }

  async queryWidget(
    _widgetId: string,
    filters: DashboardFilterValue[],
  ): Promise<WidgetQueryResponse> {
    this.queryFilters.push(filters.map((filter) => ({ ...filter })));
    if (this.failNextQuery) {
      this.failNextQuery = false;
      throw new Error('synthetic dashboard failure');
    }

    const selectedTeam = filters.find((filter) => filter.filterId === 'team-filter')?.value ?? 'All';
    const label = selectedTeam === 'All' ? 'Castle FC' : selectedTeam;
    return {
      widgetId: 'points-by-team',
      chartType: 'bar',
      title: 'Points by team',
      series: [
        {
          metricId: 'points',
          label: 'Points',
          points: [{ label, value: 81, dimensionValue: label, drilldownKey: null }],
        },
      ],
      columns: [
        { id: 'team', label: 'Team', align: 'left' },
        { id: 'points', label: 'Points', align: 'right' },
      ],
      rows: [{ cells: { team: label, points: 81 } }],
      filtersApplied: filters,
      validationIssues: [],
      empty: false,
      partial: false,
    };
  }

  async drilldown(): Promise<DashboardDrilldownResponse> {
    throw new Error('not used');
  }
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('AnalyticsDashboardPage recovery', () => {
  test('preserves a selected filter while retrying a failed widget query', async () => {
    const client = new RecoveringDashboardClient();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AnalyticsDashboardPage dashboardClient={client} />);
      await flushPromises();
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    client.failNextQuery = true;

    await act(async () => {
      select.value = 'River Rangers';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await flushPromises();
    });

    expect(select.value).toBe('River Rangers');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to load analytics dashboard data from the API.',
    );

    const retryButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Retry dashboard',
    ) as HTMLButtonElement;

    await act(async () => {
      retryButton.click();
      await flushPromises();
    });

    expect(select.value).toBe('River Rangers');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain('River Rangers');
    expect(client.queryFilters.at(-1)).toEqual([
      { filterId: 'team-filter', value: 'River Rangers' },
    ]);

    await act(async () => root.unmount());
    container.remove();
  });
});
