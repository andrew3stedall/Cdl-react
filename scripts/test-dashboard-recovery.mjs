import { chromium } from 'playwright';

const baseUrl = process.env.APP_PREVIEW_URL ?? 'http://127.0.0.1:5173';

const authenticatedSession = {
  is_authenticated: true,
  user: {
    id: 'browser-manager',
    email: 'manager@example.com',
    display_name: 'Browser Manager',
    roles: ['manager'],
  },
  expires_at: '2099-01-01T00:00:00Z',
};

const dashboardConfig = {
  id: 'manager-dashboard',
  title: 'Manager Analytics Dashboard',
  gameweek: { id: 'gw-12', name: 'Gameweek 12', number: 12 },
  metrics: [
    { id: 'points', label: 'Points', description: 'Total points', aggregation: 'sum', format: 'points' },
  ],
  dimensions: [
    { id: 'team', label: 'Team', description: 'Draft team', values: ['Castle FC', 'River Rangers'] },
  ],
  filters: [
    {
      id: 'team-filter',
      label: 'Team',
      dimension_id: 'team',
      scope: 'global',
      options: ['All', 'Castle FC', 'River Rangers'],
      default_value: 'All',
    },
  ],
  widgets: [
    {
      id: 'points-by-team',
      title: 'Points by team',
      description: 'Current gameweek scoring snapshot.',
      chart_type: 'bar',
      metric_id: 'points',
      dimension_id: 'team',
      filter_ids: ['team-filter'],
      supports_drilldown: false,
      sort: 'desc',
    },
  ],
};

async function mockDashboardApi(page) {
  let delayNextQuery = true;
  let failNextQuery = false;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === '/api/auth/session') {
      return route.fulfill({ json: authenticatedSession });
    }

    if (path === '/api/contracts/theme-presets') {
      return route.fulfill({ json: { presets: [] } });
    }

    if (path === '/api/dashboard/config') {
      return route.fulfill({ json: dashboardConfig });
    }

    if (path.endsWith('/api/dashboard/widgets/points-by-team/query')) {
      if (delayNextQuery) {
        delayNextQuery = false;
        await new Promise((resolve) => setTimeout(resolve, 750));
      }

      if (failNextQuery) {
        failNextQuery = false;
        return route.fulfill({
          status: 503,
          json: {
            code: 'dashboard_unavailable',
            message: 'Synthetic dashboard backend failure.',
            details: {},
          },
        });
      }

      const requestBody = request.postDataJSON();
      const filters = requestBody.filters ?? [];
      const selectedTeam = filters.find((filter) => filter.filter_id === 'team-filter')?.value ?? 'All';
      const label = selectedTeam === 'All' ? 'Castle FC' : selectedTeam;
      const value = selectedTeam === 'All' ? 72 : 81;

      return route.fulfill({
        json: {
          widget_id: 'points-by-team',
          chart_type: 'bar',
          title: 'Points by team',
          series: [
            {
              metric_id: 'points',
              label: 'Points',
              points: [
                {
                  label,
                  value,
                  dimension_value: label,
                  drilldown_key: null,
                },
              ],
            },
          ],
          columns: [
            { id: 'team', label: 'Team', align: 'left' },
            { id: 'points', label: 'Points', align: 'right' },
          ],
          rows: [{ cells: { team: label, points: value } }],
          filters_applied: filters,
          validation_issues: [],
          empty: false,
          partial: false,
        },
      });
    }

    return route.fulfill({ status: 404, json: { error: `No dashboard-recovery mock for ${path}` } });
  });

  return {
    failNextQuery() {
      failNextQuery = true;
    },
  };
}

async function runDashboardRecovery(viewport, viewportName) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const api = await mockDashboardApi(page);

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('status').filter({ hasText: 'Loading dashboard data' }).waitFor();
  await page.getByRole('button', { name: /Castle FC.*72/ }).waitFor();

  api.failNextQuery();
  const teamFilter = page.getByRole('combobox', { name: 'Team', exact: true });
  await teamFilter.selectOption('River Rangers');

  const alert = page.getByRole('alert');
  await alert.getByText('Unable to load analytics dashboard data from the API.').waitFor();
  if ((await teamFilter.inputValue()) !== 'River Rangers') {
    throw new Error(`${viewportName}: expected the failed filter selection to remain visible`);
  }

  await alert.getByRole('button', { name: 'Retry dashboard' }).click();
  await page.getByRole('button', { name: /River Rangers.*81/ }).waitFor();
  await alert.waitFor({ state: 'hidden' });

  if ((await teamFilter.inputValue()) !== 'River Rangers') {
    throw new Error(`${viewportName}: expected the selected filter to survive retry recovery`);
  }

  await context.close();
  await browser.close();
}

await runDashboardRecovery({ width: 390, height: 844 }, 'mobile');
await runDashboardRecovery({ width: 1440, height: 900 }, 'desktop');
