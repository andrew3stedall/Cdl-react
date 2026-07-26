import { chromium } from 'playwright';

const baseUrl = process.env.APP_PREVIEW_URL ?? 'http://127.0.0.1:5173';


const teams = [
  { id: 'team-castle', name: 'Castle FC', short_name: 'CAS' },
  { id: 'team-river', name: 'River Rangers', short_name: 'RIV' },
];

const gameweeks = [12, 13, 14, 15, 16].map((number) => ({
  id: 'gw-' + number,
  name: 'Gameweek ' + number,
  number,
}));

const dashboardConfig = {
  id: 'manager-dashboard',
  title: 'Manager Analytics Dashboard',
  gameweek: gameweeks[0],
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
      supports_drilldown: true,
      sort: 'desc',
    },
  ],
};

const fdrScale = [
  { rating: 1, band: 'very_easy', label: 'Very easy', foreground_token: 'var(--color-success)', background_token: 'var(--color-success-soft)', contrast_ratio: 4.8 },
  { rating: 3, band: 'medium', label: 'Medium', foreground_token: 'var(--color-warning)', background_token: 'var(--color-warning-soft)', contrast_ratio: 4.7 },
  { rating: 5, band: 'very_hard', label: 'Very hard', foreground_token: 'var(--color-danger)', background_token: 'var(--color-danger-soft)', contrast_ratio: 4.9 },
];

function fdrView(view, selectedTeamId) {
  const selectedTeams = selectedTeamId ? teams.filter((team) => team.id === selectedTeamId) : teams;

  return {
    view,
    filters: {
      season: '2025/26',
      team_id: selectedTeamId,
      gameweek_start: 12,
      gameweek_end: 16,
    },
    scales: fdrScale,
    rows: selectedTeams.map((team, index) => ({
      team,
      average_rating: index === 0 ? 2.3 : 3.1,
      fixtures: [
        {
          id: view + '-' + team.id + '-12',
          opponent: team.id === 'team-castle' ? teams[1] : teams[0],
          gameweek: gameweeks[0],
          venue: 'H',
          rating: index === 0 ? 2 : 3,
          band: index === 0 ? 'easy' : 'medium',
          abbreviation: team.id === 'team-castle' ? 'RIV (H)' : 'CAS (H)',
        },
      ],
    })),
    available_teams: teams,
    available_gameweeks: gameweeks,
  };
}

async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/api/health' || path === '/health') {
      return route.fulfill({ json: { status: 'ok' } });
    }

    if (path === '/api/contracts/theme-presets') {
      return route.fulfill({ json: { presets: [] } });
    }

    if (path === '/api/dashboard/config') {
      return route.fulfill({ json: dashboardConfig });
    }

    if (path.endsWith('/api/dashboard/widgets/points-by-team/query')) {
      const requestBody = route.request().postDataJSON();
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
                { label, value, dimension_value: label, drilldown_key: label.toLowerCase().replaceAll(' ', '-') },
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

    if (path.endsWith('/api/dashboard/widgets/points-by-team/drilldown')) {
      return route.fulfill({
        json: {
          widget_id: 'points-by-team',
          title: 'Castle FC drill-down',
          context: { team: 'Castle FC' },
          columns: [
            { id: 'player', label: 'Player', align: 'left' },
            { id: 'points', label: 'Points', align: 'right' },
          ],
          rows: [{ cells: { player: 'Casey Midfielder', points: 14 } }],
        },
      });
    }

    if (path === '/api/fdr') {
      const selectedTeamId = url.searchParams.get('team_id');
      return route.fulfill({
        json: {
          attack: fdrView('attack', selectedTeamId),
          defence: fdrView('defence', selectedTeamId),
          scales: fdrScale,
        },
      });
    }

    return route.fulfill({ status: 404, json: { error: `No interaction-test mock for ${path}` } });
  });
}

async function expectStatus(page, expected) {
  const status = page.getByRole('status');
  await status.waitFor({ state: 'visible' });
  const message = (await status.textContent()) ?? '';

  if (!message.includes(expected)) {
    throw new Error(`Expected status to include "${expected}", received "${message.trim()}"`);
  }
}

async function testTeamSelection(page) {
  await page.goto(`${baseUrl}/team-selection`, { waitUntil: 'networkidle' });
  await expectStatus(page, 'Team selection loaded.');

  const alexSlot = page.getByLabel('Move Alex Keeper');
  await alexSlot.selectOption('bench');
  await expectStatus(page, 'Player moved to bench.');

  await page.getByRole('button', { name: 'Save lineup' }).click();
  await expectStatus(page, 'Invalid lineup.');

  await alexSlot.selectOption('starter');
  await expectStatus(page, 'Player moved to starter.');

  await page.getByRole('button', { name: 'Save lineup' }).click();
  await expectStatus(page, 'Lineup saved and validated.');
}

async function testSquadManagement(page) {
  await page.goto(`${baseUrl}/squad-management`, { waitUntil: 'networkidle' });
  await expectStatus(page, 'Squad data loaded.');

  const search = page.getByRole('textbox', { name: 'Search players' });
  await search.fill('Casey');

  await page.getByRole('button', { name: 'Interest' }).click();
  await expectStatus(page, 'Casey Midfielder added to interests.');

  const interests = page.locator('section[aria-label="Interests and proposed trades"]');
  await interests.getByText('Casey Midfielder', { exact: true }).waitFor();

  await page.getByRole('cell', { name: 'Casey Midfielder', exact: true }).click();
  const playerDialog = page.getByRole('dialog', { name: 'Player detail' });
  await playerDialog.getByRole('heading', { name: 'Casey Midfielder' }).waitFor();
  await playerDialog.getByText('Points: 61 · Value: £7.5m', { exact: true }).waitFor();
  await playerDialog.getByRole('button', { name: 'Close' }).click();
  await playerDialog.waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: 'Propose sample trade' }).click();
  await page.getByText('Trade proposal created.', { exact: false }).waitFor();

  const rulesLink = page.getByRole('link', { name: 'Trade Window' });
  const href = await rulesLink.getAttribute('href');
  if (href !== '/rules#trade-window') {
    throw new Error(`Expected Trade Window link to target /rules#trade-window, received "${href}"`);
  }
}

async function testDashboard(page) {
  await page.goto(baseUrl + '/dashboard', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Manager Analytics Dashboard' }).waitFor();

  await page.getByRole('combobox', { name: 'Team', exact: true }).selectOption('Castle FC');
  const chartPoint = page.getByRole('button', { name: /Castle FC.*81/ });
  await chartPoint.waitFor();
  await chartPoint.click();

  const drilldown = page.getByRole('dialog', { name: 'Drill-down dialog' });
  await drilldown.getByRole('heading', { name: 'Castle FC drill-down' }).waitFor();
  await drilldown.getByText('Casey Midfielder', { exact: true }).waitFor();
  await drilldown.getByRole('button', { name: 'Close' }).click();
  await drilldown.waitFor({ state: 'hidden' });
}

async function testFixtureDifficulty(page) {
  await page.goto(baseUrl + '/fdr', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Attack and defence FDR' }).waitFor();

  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === '/api/fdr' && url.searchParams.get('team_id') === 'team-river';
  });
  await page.getByRole('combobox', { name: 'Team', exact: true }).selectOption('team-river');
  await filteredRequest;

  await page.getByRole('rowheader', { name: 'RIV', exact: true }).first().waitFor();
  const attackTable = page.getByRole('region', { name: 'Attack FDR table' });
  await attackTable.getByText('CAS (H)', { exact: true }).waitFor();
}

async function run() {
  const browser = await chromium.launch();
  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await mockApi(page);

    if (viewport.name === 'mobile') {
      await testTeamSelection(page);
      await testSquadManagement(page);
    }

    await testDashboard(page);
    await testFixtureDifficulty(page);

    await context.close();
  }

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
