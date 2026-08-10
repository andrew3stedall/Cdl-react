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
    gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1, deadline_at: '2026-08-14T17:30:00Z' },
    lineup: [
      { id: 'player-1', display_name: 'Alex Keeper', position: 'GKP', team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, slot: 'starter', slot_order: 1, is_captain: false, is_vice_captain: false },
      { id: 'player-2', display_name: 'Ben Defender', position: 'DEF', team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' }, epl_team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' }, slot: 'starter', slot_order: 2, is_captain: false, is_vice_captain: false },
      { id: 'player-3', display_name: 'Casey Midfielder', position: 'MID', team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, slot: 'starter', slot_order: 3, is_captain: true, is_vice_captain: false },
      { id: 'player-4', display_name: 'Riley Forward', position: 'FWD', team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' }, epl_team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' }, slot: 'bench', slot_order: 1, is_captain: false, is_vice_captain: true },
      { id: 'player-5', display_name: 'Morgan Reserve', position: 'MID', team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, slot: 'reserve', slot_order: 1, is_captain: false, is_vice_captain: false },
    ],
    chips: [
      { id: 'triple-captain', name: 'Triple Captain', status: 'available', rule_reference: null },
      { id: 'dual-captain', name: 'Dual Captain', status: 'available', rule_reference: null },
      { id: 'auto-captain', name: 'Auto Captain', status: 'available', rule_reference: null },
      { id: 'bench-boost', name: 'Bench Boost', status: 'used', rule_reference: null },
      { id: 'best-xi', name: 'Best XI', status: 'available', rule_reference: null },
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

const squadSummary = {
  manager_team: { id: 'team-exeter-gently', name: 'Exeter Gently' },
  gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
  players: [
    { id: 'player-1', display_name: 'Alex Keeper', position: 'GKP', epl_team: { name: 'Arsenal', short_name: 'ARS' }, status: 'owned', points: 48, value: 5.0 },
  ],
};

const scoutingPlayers = {
  players: [
    ...squadSummary.players,
    { id: 'player-3', display_name: 'Casey Midfielder', position: 'MID', epl_team: { name: 'Arsenal', short_name: 'ARS' }, status: 'available', points: 61, value: 7.5 },
  ],
};

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
  const interests = [];
  const trades = [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/auth/session') {
      return route.fulfill({
        json: sessionAuthenticated ? authenticatedSession : unauthenticatedSession,
      });
    }

    if (path === '/api/auth/login') {
      const credentials = request.postDataJSON();
      if (
        credentials.email !== authenticatedSession.user.email
        || credentials.password !== 'browser-login-secret'
      ) {
        return route.fulfill({
          status: 401,
          json: {
            code: 'unauthenticated',
            message: 'Invalid email or password.',
            details: {},
          },
        });
      }

      sessionAuthenticated = true;
      return route.fulfill({ json: { session: authenticatedSession } });
    }

    if (path === '/api/auth/logout') {
      sessionAuthenticated = false;
      return route.fulfill({ json: { session: unauthenticatedSession } });
    }

    if (path === '/api/squad/summary') {
      return route.fulfill({ json: squadSummary });
    }

    if (path === '/api/scouting/players') {
      return route.fulfill({ json: scoutingPlayers });
    }

    if (path === '/api/squad/changes' && request.method() === 'GET') {
      return route.fulfill({ json: { available_to_add: scoutingPlayers.players.filter((player) => player.status === 'available') } });
    }

    if (path === '/api/squad/changes' && request.method() === 'POST') {
      return route.fulfill({ json: squadSummary });
    }

    if (path === '/api/squad/notifications') {
      return route.fulfill({ json: { notifications: [] } });
    }

    if (path.startsWith('/api/fpl/players/') && path.endsWith('/history')) {
      return route.fulfill({
        json: {
          player_id: path.split('/').at(-2),
          fetched_at: '2026-08-09T00:00:00Z',
          response_sha256: 'browser-fixture',
          history: [],
          fixtures: [],
        },
      });
    }

    if (path === '/api/interests' && request.method() === 'GET') {
      return route.fulfill({ json: interests });
    }

    if (path === '/api/interests' && request.method() === 'POST') {
      const body = request.postDataJSON();
      if (interests.some((interest) => interest.player.id === body.player_id)) {
        return route.fulfill({
          status: 422,
          json: { code: 'validation_error', message: 'Interest already exists.', issues: [] },
        });
      }
      const interest = {
        id: 'interest-primary-casey',
        player: { id: 'player-3', display_name: 'Casey Midfielder' },
        gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
        note: null,
      };
      interests.push(interest);
      return route.fulfill({ json: interest });
    }

    if (path === '/api/trades' && request.method() === 'GET') {
      return route.fulfill({ json: { trades } });
    }

    if (path === '/api/trades' && request.method() === 'POST') {
      const trade = {
        id: 'trade-primary-1',
        status: 'proposed',
        assets: [
          { player: { id: 'player-1', display_name: 'Alex Keeper' } },
          { player: { id: 'player-4', display_name: 'Dev Forward' } },
        ],
      };
      trades.push(trade);
      return route.fulfill({ json: trade });
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
        const requestBody = request.postDataJSON();
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
        const { active } = request.postDataJSON();
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
  await page.goto(`${baseUrl}/team-selection`, { waitUntil: 'networkidle' });
  await expectStatus(page, 'Exeter Gently squad ready for review.');
  await page.getByText('Next deadline', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'View as list' }).click();
  await page.locator('[aria-label="Starting XI players table"]').waitFor();

  if (await page.locator('[aria-label="Starting XI players table"] select').count() !== 0) {
    throw new Error('List view must not expose player movement dropdowns');
  }

  await page.getByRole('button', { name: 'Player actions for Alex Keeper' }).click();
  await page.getByRole('button', { name: /Substitute player/ }).click();
  await page.getByRole('button', { name: 'Substitute with Riley Forward' }).first().click();
  await page.getByRole('button', { name: 'Bench position goalkeeper' }).click();
  await page.getByRole('button', { name: /Confirm substitution/ }).click();
  await expectStatus(page, 'Alex Keeper swapped with Riley Forward.');

  await page.getByRole('button', { name: 'Save lineup' }).click();
  await expectStatus(page, 'Lineup saved and validated.');

  await page.getByRole('button', { name: 'Player actions for Ben Defender' }).click();
  await page.getByRole('button', { name: /Substitute player/ }).click();
  await page.getByRole('button', { name: 'Substitute with Alex Keeper' }).first().click();
  await page.getByRole('button', { name: 'Bench position 2' }).click();
  await page.getByRole('button', { name: /Confirm substitution/ }).click();
  await expectStatus(page, 'Ben Defender swapped with Alex Keeper.');
  await page.getByRole('button', { name: 'Save lineup' }).click();
  await expectStatus(page, 'Lineup saved and validated.');

  await page.getByRole('button', { name: 'Triple Captain, available' }).click();
  await expectStatus(page, 'Triple Captain chip state updated.');

  await page.reload({ waitUntil: 'networkidle' });
  await expectStatus(page, 'Exeter Gently squad ready for review.');

  if (await page.getByRole('button', { name: 'Player actions for Ben Defender' }).count() !== 1) {
    throw new Error('Expected the saved lineup to render its player action controls after reload');
  }
  if (await page.locator('[aria-label="Starting XI players table"] select').count() !== 0) {
    throw new Error('Expected list view to remain free of player movement dropdowns after reload');
  }
  await page.getByRole('button', { name: 'Triple Captain, active' }).waitFor();
}

async function testManagerDesk(page) {
  await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Managers Desk' }).waitFor();
  await page.getByText('Action centre', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Set your team' }).click();
  await expectPath(page, '/team-selection');
}

async function testSquadManagement(page) {
  await page.goto(`${baseUrl}/squad-management`, { waitUntil: 'networkidle' });
  await expectStatus(page, 'Exeter Gently squad ready for review.');

  await page.getByRole('button', { name: 'View as pitch' }).click();
  const pitch = page.locator('section[aria-label="Squad pitch"]');
  await pitch.waitFor();
  await pitch.locator('section[aria-label="Bench"]').waitFor();
  await page.getByRole('button', { name: 'View as list' }).click();
  await page.locator('[aria-label="Starting XI players table"]').waitFor();
  await page.getByRole('button', { name: 'View as pitch' }).click();
  await pitch.waitFor();
}

async function testDashboard(page) {
  await page.goto(baseUrl + '/dashboard/analytics', { waitUntil: 'networkidle' });
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
  await page.waitForFunction(
    (path) => window.location.pathname === path,
    expectedPath,
  );
  const path = new URL(page.url()).pathname;
  if (path !== expectedPath) {
    throw new Error('Expected browser path "' + expectedPath + '", received "' + path + '"');
  }
}

async function testShellAndLeagueNavigation(page, viewportName) {
  await page.goto(baseUrl + '/rules', { waitUntil: 'networkidle' });

  let primaryNavigation;
  if (viewportName === 'mobile') {
    const menuButton = page.getByRole('button', { name: 'Menu', exact: true });
    if (await menuButton.getAttribute('aria-expanded') !== 'false') {
      throw new Error('Expected the mobile menu to start collapsed');
    }
    await menuButton.click();
    if (await menuButton.getAttribute('aria-expanded') !== 'true') {
      throw new Error('Expected the mobile menu to expose aria-expanded=true after opening');
    }
    primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' });
    await primaryNavigation.waitFor({ state: 'visible' });
  } else {
    primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' });
  }

  await primaryNavigation.getByRole('link', { name: 'League', exact: true }).click();
  await expectPath(page, '/league');

  const leagueNavigation = page.getByRole('navigation', { name: 'League navigation' });
  await leagueNavigation.getByRole('link', { name: 'Fixtures', exact: true }).click();
  await expectPath(page, '/league/fixtures');
  await page.locator('#league-title').filter({ hasText: 'Fixtures & results' }).waitFor();

  await leagueNavigation.getByRole('link', { name: 'Table', exact: true }).click();
  await expectPath(page, '/league/table');
  await page.locator('#league-title').filter({ hasText: 'League table' }).waitFor();

  await leagueNavigation.getByRole('link', { name: 'Knockout', exact: true }).click();
  await expectPath(page, '/league/knockout');
  await page.locator('#league-title').filter({ hasText: 'Knockout competition' }).waitFor();

  await leagueNavigation.getByRole('link', { name: 'Head-to-head', exact: true }).click();
  await expectPath(page, '/league/head-to-head');
  await page.locator('#league-title').filter({ hasText: 'Head-to-head records' }).waitFor();
}

async function testUnauthenticatedGuard(page) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.goto(baseUrl + '/team-selection', { waitUntil: 'networkidle' });
  await expectPath(page, '/login');
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await page.getByText('Castle Draft League', { exact: true }).waitFor();
  await page.getByLabel('Email address').waitFor();
  await page.getByLabel('Password', { exact: true }).waitFor();

  if (await page.getByRole('navigation', { name: 'Primary navigation' }).count() !== 0) {
    throw new Error('The login page must not expose authenticated application navigation.');
  }
}

async function testLoginAndLogout(page, api, viewportName) {
  await page.goto(baseUrl + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(authenticatedSession.user.email);
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectStatus(page, 'Invalid email or password.');
  await page.getByLabel('Password', { exact: true }).fill('browser-login-secret');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectPath(page, '/');
  if (viewportName === 'mobile') {
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
  } else {
    await page.getByLabel('Account menu for Browser Manager').click();
  }
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expectPath(page, '/login');
  api.restoreSession();
}

async function testLockedTeamSelection(page) {
  await page.goto(baseUrl + '/team-selection', { waitUntil: 'networkidle' });
  await expectStatus(page, 'Lineup locked. FPL deadline passed.');
  await page.getByRole('button', { name: 'View as list' }).click();

  const saveLineup = page.getByRole('button', { name: 'Save lineup' });
  if (!(await saveLineup.isDisabled())) {
    throw new Error('Expected Save lineup to be disabled after fixture lock');
  }
  const tripleCaptainActivate = page.getByRole('button', { name: 'Triple Captain, available' });
  if (!(await tripleCaptainActivate.isDisabled())) {
    throw new Error('Expected chip controls to be disabled after fixture lock');
  }
  await page.getByRole('button', { name: 'Player actions for Alex Keeper' }).click();
  if (!(await page.getByRole('button', { name: /Substitute player/ }).isDisabled())) {
    throw new Error('Expected substitution to be disabled after fixture lock');
  }
}

async function runViewport(viewport, viewportName) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const api = await mockApi(page);

  await testManagerDesk(page);
  await testTeamSelection(page);
  await testSquadManagement(page);
  await testDashboard(page);
  await testFixtureDifficulty(page);
  await testShellAndLeagueNavigation(page, viewportName);
  api.expireSession();
  await testUnauthenticatedGuard(page, viewportName);
  await testLoginAndLogout(page, api, viewportName);

  await context.close();
  await browser.close();
}

async function runLockedSelection() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await mockApi(page, { teamSelectionLocked: true });
  await testLockedTeamSelection(page);
  await context.close();
  await browser.close();
}

await runViewport({ width: 390, height: 844 }, 'mobile');
await runViewport({ width: 1440, height: 900 }, 'desktop');
await runLockedSelection();
