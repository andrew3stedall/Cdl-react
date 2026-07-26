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

const unauthenticatedSession = {
  is_authenticated: false,
  user: null,
  expires_at: null,
};

function teamSelectionResponse(locked = false) {
  return {
    manager_team: { id: 'team-castle', name: 'Castle FC', short_name: 'CFC' },
    gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
    lineup: [
      { id: 'player-1', display_name: 'Alex Keeper', position: 'GKP', team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, slot: 'starter', slot_order: 1, is_captain: false, is_vice_captain: false },
      { id: 'player-2', display_name: 'Ben Defender', position: 'DEF', team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' }, epl_team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' }, slot: 'starter', slot_order: 2, is_captain: false, is_vice_captain: false },
      { id: 'player-3', display_name: 'Casey Midfielder', position: 'MID', team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, slot: 'starter', slot_order: 3, is_captain: true, is_vice_captain: false },
      { id: 'player-4', display_name: 'Riley Forward', position: 'FWD', team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' }, epl_team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' }, slot: 'bench', slot_order: 1, is_captain: false, is_vice_captain: true },
      { id: 'player-5', display_name: 'Morgan Reserve', position: 'MID', team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, slot: 'reserve', slot_order: 1, is_captain: false, is_vice_captain: false },
    ],
    chips: [
      { id: 'wildcard', name: 'Wildcard', status: 'available', rule_reference: null },
      { id: 'bench-boost', name: 'Bench Boost', status: 'used', rule_reference: null },
      { id: 'triple-captain', name: 'Triple Captain', status: 'available', rule_reference: null },
    ],
    validation_messages: [],
    fixture_lock: {
      locked,
      fixture_id: locked ? 'fixture-1' : null,
      fixture_type: locked ? 'epl' : null,
      lock_scope: locked ? 'gameweek' : null,
      locked_at: locked ? '2026-07-26T09:00:00Z' : null,
      reason: locked ? 'FPL deadline passed.' : null,
    },
  };
}

const teamSelectionFixtureSummary = {
  cdl_fixtures: [{
    id: 'cdl-browser-fixture',
    gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
    home_team: { id: 'team-harbour', name: 'Harbour Athletic', short_name: 'HAR' },
    away_team: { id: 'team-mountain', name: 'Mountain United', short_name: 'MOU' },
    status: 'scheduled',
  }],
  epl_fixtures: [{
    id: 'epl-browser-fixture',
    gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
    home_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' },
    away_team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' },
    status: 'scheduled',
  }],
  cdl_table: [
    { id: 'team-harbour', name: 'Harbour Athletic', short_name: 'HAR' },
    { id: 'team-mountain', name: 'Mountain United', short_name: 'MOU' },
  ],
  epl_table: [
    { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' },
    { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' },
  ],
};

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

const leagueFixture = {
  id: 'fixture-12',
  gameweek: gameweeks[0],
  home_team: teams[0],
  away_team: teams[1],
  status: 'complete',
  kickoff_label: 'Sat 15:00',
  round_label: 'League',
  is_current: true,
  is_next: false,
  detail_available: true,
  score: {
    home_score: 72,
    away_score: 64,
    bonus_points: { 'team-castle': 3 },
    chips_played: { 'team-castle': ['wildcard'] },
    outcome: 'home_win',
  },
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

async function mockApi(page, { authenticated = true, teamSelectionLocked = false } = {}) {
  let currentTeamSelection = teamSelectionResponse(teamSelectionLocked);
  let sessionAuthenticated = authenticated;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/api/auth/session') {
      return route.fulfill({
        json: sessionAuthenticated ? authenticatedSession : unauthenticatedSession,
      });
    }

    if (path === '/api/auth/logout') {
      sessionAuthenticated = false;
      return route.fulfill({ json: { session: unauthenticatedSession } });
    }

    if (path === '/api/team-selection') {
      return route.fulfill({ json: currentTeamSelection });
    }

    if (path === '/api/team-selection/fixtures-summary') {
      return route.fulfill({ json: teamSelectionFixtureSummary });
    }

    if (path === '/api/team-selection/lineup' || path.startsWith('/api/team-selection/chips/')) {
      if (teamSelectionLocked) {
        return route.fulfill({
          status: 409,
          json: {
            code: 'conflict',
            message: 'Team selection is locked for this gameweek.',
            details: { reason: 'FPL deadline passed.', rule_reference: 'lineup-locking' },
          },
        });
      }

      if (path === '/api/team-selection/lineup') {
        const requestBody = route.request().postDataJSON();
        currentTeamSelection = {
          ...currentTeamSelection,
          lineup: currentTeamSelection.lineup.map((player) => {
            const update = requestBody.players.find((candidate) => candidate.player_id === player.id);
            return update
              ? {
                  ...player,
                  slot: update.slot,
                  slot_order: update.slot_order,
                  is_captain: update.is_captain,
                  is_vice_captain: update.is_vice_captain,
                }
              : player;
          }),
        };
      } else {
        const chipId = path.split('/').at(-1);
        const { active } = route.request().postDataJSON();
        currentTeamSelection = {
          ...currentTeamSelection,
          chips: currentTeamSelection.chips.map((chip) => ({
            ...chip,
            status: chip.id === chipId
              ? (active ? 'active' : 'available')
              : (active && chip.status === 'active' ? 'available' : chip.status),
          })),
        };
      }

      return route.fulfill({ json: currentTeamSelection });
    }

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

    if (path.startsWith('/api/league/fixtures')) {
      return route.fulfill({ json: { gameweek: gameweeks[0], fixtures: [leagueFixture] } });
    }

    if (path === '/api/league/table') {
      return route.fulfill({
        json: {
          source: 'interaction fixture',
          rows: [
            { position: 1, team: teams[0], played: 1, wins: 1, draws: 0, losses: 0, points_for: 72, points_against: 64, points_difference: 8, league_points: 3 },
            { position: 2, team: teams[1], played: 1, wins: 0, draws: 0, losses: 1, points_for: 64, points_against: 72, points_difference: -8, league_points: 0 },
          ],
        },
      });
    }

    if (path === '/api/league/knockout') {
      return route.fulfill({
        json: {
          rounds: ['Semi-final'],
          matches: [{ id: 'ko-1', round_label: 'Semi-final', fixture: leagueFixture, winner: teams[0] }],
        },
      });
    }

    if (path === '/api/league/head-to-head') {
      return route.fulfill({
        json: {
          records: [
            { team: teams[0], opponent: teams[1], played: 1, wins: 1, draws: 0, losses: 0, points_for: 72, points_against: 64 },
          ],
        },
      });
    }

    return route.fulfill({ status: 404, json: { error: `No interaction-test mock for ${path}` } });
  });

  return {
    expireSession() {
      sessionAuthenticated = false;
    },
    restoreSession() {
      sessionAuthenticated = true;
    },
  };
}

async function expectStatus(page, expected) {
  const status = page.getByRole('status');
  try {
    await status.filter({ hasText: expected }).waitFor({ state: 'visible' });
  } catch {
    const message = (await status.textContent()) ?? '';
    throw new Error(`Expected status to include "${expected}", received "${message.trim()}"`);
  }
}

async function testTeamSelection(page) {
  const fixtureSummaryRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname === '/api/team-selection/fixtures-summary',
  );
  await page.goto(`${baseUrl}/team-selection`, { waitUntil: 'networkidle' });
  await fixtureSummaryRequest;
  await page.getByRole('region', { name: 'Fixture and table summaries' })
    .getByText('Harbour Athletic vs Mountain United', { exact: true }).waitFor();
  await expectStatus(page, 'Team selection loaded.');

  const alexSlot = page.getByLabel('Move Alex Keeper');
  await alexSlot.selectOption('bench');
  await expectStatus(page, 'Player moved to bench.');

  await page.getByRole('button', { name: 'Save lineup' }).click();
  await expectStatus(page, 'Invalid lineup.');

  await alexSlot.selectOption('starter');
  await expectStatus(page, 'Player moved to starter.');

  await page.getByLabel('Move Ben Defender').selectOption('bench');
  await page.getByLabel('Move Riley Forward').selectOption('starter');
  await page.getByRole('button', { name: 'Save lineup' }).click();
  await expectStatus(page, 'Lineup saved and validated.');

  const wildcardCard = page.getByRole('heading', { name: 'Wildcard' }).locator('..');
  await wildcardCard.getByRole('button', { name: 'Activate' }).click();
  await expectStatus(page, 'Wildcard chip state updated.');

  await page.reload({ waitUntil: 'networkidle' });
  await expectStatus(page, 'Team selection loaded.');

  if (await page.getByLabel('Move Ben Defender').inputValue() !== 'bench') {
    throw new Error('Expected the saved Ben Defender bench slot to survive a reload');
  }
  if (await page.getByLabel('Move Riley Forward').inputValue() !== 'starter') {
    throw new Error('Expected the saved Riley Forward starter slot to survive a reload');
  }
  await page.getByRole('heading', { name: 'Wildcard' }).locator('..')
    .getByRole('button', { name: 'Deactivate' }).waitFor();
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

async function expectPath(page, expectedPath) {
  const path = new URL(page.url()).pathname;
  if (path !== expectedPath) {
    throw new Error('Expected browser path "' + expectedPath + '", received "' + path + '"');
  }
}

async function testShellAndLeagueNavigation(page, viewportName) {
  await page.goto(baseUrl + '/rules', { waitUntil: 'networkidle' });

  let navigation;
  if (viewportName === 'mobile') {
    const menuButton = page.getByRole('button', { name: 'Menu', exact: true });
    if (await menuButton.getAttribute('aria-expanded') !== 'false') {
      throw new Error('Expected mobile navigation to start closed');
    }

    await menuButton.click();
    navigation = page.getByRole('dialog', { name: 'Navigation' });
    await navigation.waitFor();

    if (await menuButton.getAttribute('aria-expanded') !== 'true') {
      throw new Error('Expected mobile navigation to report its open state');
    }
  } else {
    navigation = page.getByRole('complementary', { name: 'Primary navigation' });
  }

  await navigation.getByRole('button', { name: 'League', exact: true }).click();
  await page.getByRole('heading', { name: 'League Fixtures and Table' }).waitFor();
  await page.getByRole('region', { name: 'League standings table' }).getByText('Castle FC', { exact: true }).waitFor();
  await expectPath(page, '/league');

  if (viewportName === 'mobile') {
    const menuButton = page.getByRole('button', { name: 'Menu', exact: true });
    if (await menuButton.getAttribute('aria-expanded') !== 'false') {
      throw new Error('Expected mobile navigation to close after route selection');
    }
    await menuButton.click();
    navigation = page.getByRole('dialog', { name: 'Navigation' });
  }

  const leagueNavigation = navigation.getByRole('button', { name: 'League', exact: true });
  if (await leagueNavigation.getAttribute('aria-current') !== 'page') {
    throw new Error('Expected League navigation item to expose the active route');
  }

  await navigation.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await page.getByRole('heading', { name: 'Manager Analytics Dashboard' }).waitFor();
  await expectPath(page, '/dashboard');

  await page.goBack();
  await expectPath(page, '/league');
  await page.getByRole('heading', { name: 'League Fixtures and Table' }).waitFor();
}

async function testSessionExpiryAndRecovery(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const sessionControl = await mockApi(page);

  await page.goto(baseUrl + '/team-selection', { waitUntil: 'networkidle' });
  await expectStatus(page, 'Team selection loaded.');
  await page.getByRole('region', { name: 'Authenticated session' })
    .getByText('Signed in as Browser Manager').waitFor();

  sessionControl.expireSession();
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expectStatus(page, 'Sign in to access');

  if (await page.getByRole('button', { name: 'Save lineup' }).count()) {
    throw new Error('Expected expired session to withdraw protected team-selection controls');
  }

  sessionControl.restoreSession();
  await page.getByRole('button', { name: 'Retry session' }).click();
  await expectStatus(page, 'Team selection loaded.');
  await page.getByRole('region', { name: 'Authenticated session' })
    .getByText('Signed in as Browser Manager').waitFor();

  const logoutRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname === '/api/auth/logout' && request.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Sign out' }).click();
  await logoutRequest;
  await expectStatus(page, 'Sign in to access');

  await context.close();
}

async function testLockedTeamSelection(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await mockApi(page, { teamSelectionLocked: true });

  const fixtureSummaryRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname === '/api/team-selection/fixtures-summary',
  );
  await page.goto(baseUrl + '/team-selection', { waitUntil: 'networkidle' });
  await fixtureSummaryRequest;
  await page.getByRole('region', { name: 'Fixture and table summaries' })
    .getByText('Harbour Athletic vs Mountain United', { exact: true }).waitFor();
  await expectStatus(page, 'Lineup locked. FPL deadline passed.');
  await page.getByRole('region', { name: 'Lineup lock' }).getByText('View-only lineup').waitFor();

  const allSelectsDisabled = await page.locator('select[aria-label^="Move "]').evaluateAll((controls) =>
    controls.length > 0 && controls.every((control) => control.disabled),
  );
  if (!allSelectsDisabled) {
    throw new Error('Expected every lineup movement control to be disabled after fixture lock');
  }

  const allChipActionsDisabled = await page
    .getByRole('region', { name: 'Chip selector' })
    .getByRole('button')
    .evaluateAll((controls) => controls.length > 0 && controls.every((control) => control.disabled));
  if (!allChipActionsDisabled) {
    throw new Error('Expected every chip action to be disabled after fixture lock');
  }

  if (!(await page.getByRole('button', { name: 'Save lineup' }).isDisabled())) {
    throw new Error('Expected Save lineup to be disabled after fixture lock');
  }

  await context.close();
}

async function testUnauthenticatedSessionBoundary(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await mockApi(page, { authenticated: false });

  await page.goto(baseUrl + '/team-selection', { waitUntil: 'networkidle' });
  await expectStatus(page, 'Sign in to access');
  await expectPath(page, '/team-selection');

  if (await page.getByRole('button', { name: 'Save lineup' }).count()) {
    throw new Error('Expected protected team-selection controls to stay hidden without a session');
  }

  if (await page.getByRole('button', { name: 'Menu', exact: true }).count()) {
    throw new Error('Expected the authenticated application shell to stay hidden without a session');
  }

  await context.close();
}

async function run() {
  const browser = await chromium.launch();
  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await testUnauthenticatedSessionBoundary(browser, viewport);
    await testSessionExpiryAndRecovery(browser, viewport);
    await testLockedTeamSelection(browser, viewport);

    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await mockApi(page);

    await testTeamSelection(page);
    if (viewport.name === 'mobile') {
      await testSquadManagement(page);
    }

    await testShellAndLeagueNavigation(page, viewport.name);
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
