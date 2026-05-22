import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { App } from './App';
import type { SessionState, UserPreferences } from './contracts';
import type {
  DashboardClient,
  DashboardConfig,
  DashboardDrilldownResponse,
  WidgetQueryResponse,
} from './dashboard-api';
import type { PreferenceClient } from './preferences-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

class MemoryPreferenceClient implements PreferenceClient {
  preferences: UserPreferences = { themePreset: 'classic' };

  async getPreferences(): Promise<UserPreferences> {
    return this.preferences;
  }

  async updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
    this.preferences = preferences;
    return preferences;
  }
}

class MemoryDashboardClient implements DashboardClient {
  async getConfig(): Promise<DashboardConfig> {
    return {
      id: 'manager-analytics',
      title: 'Manager Analytics Dashboard',
      gameweek: { id: 'gw-12', name: 'Gameweek 12', number: 12 },
      filters: [],
      metrics: [],
      dimensions: [],
      widgets: [
        {
          id: 'team-points',
          title: 'Points by CDL team',
          description: 'Total fantasy points by manager team.',
          chartType: 'bar',
          metricId: 'fantasy_points',
          dimensionId: 'cdl_team',
          filterIds: [],
          supportsDrilldown: true,
          sort: 'desc',
        },
      ],
    };
  }

  async queryWidget(): Promise<WidgetQueryResponse> {
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
              label: 'Castle FC',
              value: 74,
              dimensionValue: 'Castle FC',
              drilldownKey: 'castle',
            },
          ],
        },
      ],
      columns: [{ id: 'cdl_team', label: 'CDL team', align: 'left' }],
      rows: [{ cells: { cdl_team: 'Castle FC' } }],
      filtersApplied: [],
      validationIssues: [],
      empty: false,
      partial: false,
    };
  }

  async drilldown(): Promise<DashboardDrilldownResponse> {
    return {
      widgetId: 'team-points',
      title: 'Drilldown',
      context: {},
      columns: [],
      rows: [],
    };
  }
}

function renderApp(initialPath: string, session?: SessionState) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <App
        dashboardClient={new MemoryDashboardClient()}
        initialPath={initialPath}
        preferenceClient={new MemoryPreferenceClient()}
        session={session}
      />,
    );
  });
  return { container, root };
}

describe('dashboard shell integration', () => {
  test('routes authenticated managers to dashboard inside shared shell', async () => {
    const { container } = renderApp('/dashboard');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Dashboard');
    expect(container.textContent).toContain('Manager Analytics Dashboard');
    expect(container.textContent).toContain('Signed in as CDL Manager');
  });

  test('blocks unauthenticated dashboard route before rendering dashboard UI', () => {
    const session: SessionState = {
      isAuthenticated: false,
      user: null,
      expiresAt: null,
    };

    const { container } = renderApp('/dashboard', session);

    expect(container.textContent).toContain('Sign in to access');
    expect(container.textContent).not.toContain('Manager Analytics Dashboard');
  });
});
