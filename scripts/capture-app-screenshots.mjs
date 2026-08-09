import { mkdir } from 'node:fs/promises';
import axe from 'axe-core';
import { chromium } from 'playwright';

const baseUrl = process.env.APP_PREVIEW_URL ?? 'http://127.0.0.1:5173';
const outputDir = process.env.SCREENSHOT_DIR ?? 'artifacts/app-screenshots';

const viewports = [
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
  { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 1 },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
];

const routes = [
  ['overview', '/'],
  ['league', '/league'],
  ['dashboard', '/dashboard'],
  ['fdr', '/fdr'],
  ['squad-management', '/squad-management'],
  ['team-selection', '/team-selection'],
];

const screenshotSession = {
  is_authenticated: true,
  user: {
    id: 'screenshot-manager',
    email: 'manager@example.com',
    display_name: 'Screenshot Manager',
    roles: ['manager'],
  },
  expires_at: '2099-01-01T00:00:00Z',
};

const unauthenticatedScreenshotSession = {
  is_authenticated: false,
  user: null,
  expires_at: null,
};

const screenshotTeamSelection = {
  manager_team: { id: 'team-castle', name: 'Castle FC', short_name: 'CFC' },
  gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1, deadline_at: '2026-08-14T17:30:00Z' },
  lineup: [
    { id: 'player-1', display_name: 'Alex Keeper', position: 'GKP', epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, slot: 'starter', slot_order: 1, is_captain: false, is_vice_captain: false },
    { id: 'player-2', display_name: 'Ben Defender', position: 'DEF', epl_team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' }, slot: 'starter', slot_order: 2, is_captain: false, is_vice_captain: false },
    { id: 'player-6', display_name: 'Dana Fullback', position: 'DEF', epl_team: { id: 'epl-liv', name: 'Liverpool', short_name: 'LIV' }, slot: 'starter', slot_order: 3, is_captain: false, is_vice_captain: false },
    { id: 'player-7', display_name: 'Elliot Centreback', position: 'DEF', epl_team: { id: 'epl-new', name: 'Newcastle United', short_name: 'NEW' }, slot: 'starter', slot_order: 4, is_captain: false, is_vice_captain: false },
    { id: 'player-8', display_name: 'Frankie Wingback', position: 'DEF', epl_team: { id: 'epl-tot', name: 'Tottenham Hotspur', short_name: 'TOT' }, slot: 'starter', slot_order: 5, is_captain: false, is_vice_captain: false },
    { id: 'player-3', display_name: 'Casey Midfielder', position: 'MID', epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, slot: 'starter', slot_order: 6, is_captain: true, is_vice_captain: false },
    { id: 'player-9', display_name: 'Jamie Playmaker', position: 'MID', epl_team: { id: 'epl-che', name: 'Chelsea', short_name: 'CHE' }, slot: 'starter', slot_order: 7, is_captain: false, is_vice_captain: true },
    { id: 'player-10', display_name: 'Morgan Winger', position: 'MID', epl_team: { id: 'epl-mun', name: 'Manchester United', short_name: 'MUN' }, slot: 'starter', slot_order: 8, is_captain: false, is_vice_captain: false },
    { id: 'player-11', display_name: 'Taylor Eight', position: 'MID', epl_team: { id: 'epl-whu', name: 'West Ham United', short_name: 'WHU' }, slot: 'starter', slot_order: 9, is_captain: false, is_vice_captain: false },
    { id: 'player-12', display_name: 'Riley Forward', position: 'FWD', epl_team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' }, slot: 'starter', slot_order: 10, is_captain: false, is_vice_captain: false },
    { id: 'player-13', display_name: 'Jordan Striker', position: 'FWD', epl_team: { id: 'epl-avl', name: 'Aston Villa', short_name: 'AVL' }, slot: 'starter', slot_order: 11, is_captain: false, is_vice_captain: false },
    { id: 'player-4', display_name: 'Robin Reserve', position: 'GKP', epl_team: { id: 'epl-eve', name: 'Everton', short_name: 'EVE' }, slot: 'bench', slot_order: 1, is_captain: false, is_vice_captain: false },
    { id: 'player-14', display_name: 'Sam Defender', position: 'DEF', epl_team: { id: 'epl-bha', name: 'Brighton', short_name: 'BHA' }, slot: 'bench', slot_order: 2, is_captain: false, is_vice_captain: false },
    { id: 'player-5', display_name: 'Morgan Reserve', position: 'MID', epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' }, slot: 'bench', slot_order: 3, is_captain: false, is_vice_captain: false },
    { id: 'player-15', display_name: 'Devon Forward', position: 'FWD', epl_team: { id: 'epl-wol', name: 'Wolverhampton Wanderers', short_name: 'WOL' }, slot: 'bench', slot_order: 4, is_captain: false, is_vice_captain: false },
  ],
  chips: [
    { id: 'wildcard', name: 'Wildcard', status: 'available' },
    { id: 'bench-boost', name: 'Bench Boost', status: 'used' },
    { id: 'triple-captain', name: 'Triple Captain', status: 'available' },
  ],
  validation_messages: [],
  fixture_lock: { locked: false, fixture_id: null, fixture_type: null, lock_scope: null, locked_at: null, reason: null },
};

const screenshotSquadSummary = {
  manager_team: { id: 'team-exeter-gently', name: 'Exeter Gently' },
  gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
  players: [
    { id: 'player-1', display_name: 'Alex Keeper', position: 'GKP', epl_team: { name: 'Arsenal', short_name: 'ARS' }, status: 'owned', points: 48, value: 5.0 },
    { id: 'player-2', display_name: 'Ben Defender', position: 'DEF', epl_team: { name: 'Manchester City', short_name: 'MCI' }, status: 'owned', points: 55, value: 6.2 },
    { id: 'player-6', display_name: 'Dana Fullback', position: 'DEF', epl_team: { name: 'Liverpool', short_name: 'LIV' }, status: 'owned', points: 51, value: 6.0 },
    { id: 'player-7', display_name: 'Elliot Centreback', position: 'DEF', epl_team: { name: 'Newcastle United', short_name: 'NEW' }, status: 'owned', points: 43, value: 5.4 },
    { id: 'player-8', display_name: 'Frankie Wingback', position: 'DEF', epl_team: { name: 'Tottenham Hotspur', short_name: 'TOT' }, status: 'owned', points: 47, value: 5.8 },
    { id: 'player-3', display_name: 'Casey Midfielder', position: 'MID', epl_team: { name: 'Arsenal', short_name: 'ARS' }, status: 'owned', points: 61, value: 7.5 },
    { id: 'player-9', display_name: 'Jamie Playmaker', position: 'MID', epl_team: { name: 'Chelsea', short_name: 'CHE' }, status: 'owned', points: 64, value: 8.1 },
    { id: 'player-10', display_name: 'Morgan Winger', position: 'MID', epl_team: { name: 'Manchester United', short_name: 'MUN' }, status: 'owned', points: 58, value: 7.8 },
    { id: 'player-11', display_name: 'Taylor Eight', position: 'MID', epl_team: { name: 'West Ham United', short_name: 'WHU' }, status: 'owned', points: 46, value: 6.7 },
    { id: 'player-12', display_name: 'Riley Forward', position: 'FWD', epl_team: { name: 'Manchester City', short_name: 'MCI' }, status: 'owned', points: 72, value: 13.8 },
    { id: 'player-13', display_name: 'Jordan Striker', position: 'FWD', epl_team: { name: 'Aston Villa', short_name: 'AVL' }, status: 'owned', points: 60, value: 9.0 },
    { id: 'player-4', display_name: 'Robin Reserve', position: 'GKP', epl_team: { name: 'Everton', short_name: 'EVE' }, status: 'owned', points: 35, value: 4.8 },
    { id: 'player-14', display_name: 'Sam Defender', position: 'DEF', epl_team: { name: 'Brighton', short_name: 'BHA' }, status: 'owned', points: 39, value: 4.9 },
    { id: 'player-5', display_name: 'Morgan Reserve', position: 'MID', epl_team: { name: 'Arsenal', short_name: 'ARS' }, status: 'owned', points: 41, value: 5.9 },
    { id: 'player-15', display_name: 'Devon Forward', position: 'FWD', epl_team: { name: 'Wolverhampton Wanderers', short_name: 'WOL' }, status: 'owned', points: 38, value: 6.1 },
  ],
};

const screenshotScoutingPlayers = {
  players: [
    ...screenshotSquadSummary.players,
    { id: 'player-3', display_name: 'Casey Midfielder', position: 'MID', epl_team: { name: 'Arsenal', short_name: 'ARS' }, status: 'available', points: 61, value: 7.5 },
  ],
};

const teams = [
  { id: 'team-castle', name: 'Castle FC', short_name: 'CAS' },
  { id: 'team-river', name: 'River Rangers', short_name: 'RIV' },
];

const gameweek = { id: 'gw-1', name: 'Gameweek 1', number: 1 };

const fixture = {
  id: 'fixture-1',
  gameweek,
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

const screenshotTeamSelectionFixtureSummary = {
  cdl_fixtures: [{
    id: fixture.id,
    gameweek,
    home_team: teams[0],
    away_team: teams[1],
    status: fixture.status,
  }],
  epl_fixtures: [{
    id: 'epl-screenshot-fixture',
    gameweek,
    home_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' },
    away_team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' },
    status: 'scheduled',
  }],
  cdl_table: teams,
  epl_table: [
    { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' },
    { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' },
  ],
};

const dashboardConfig = {
  id: 'manager-dashboard',
  title: 'Manager Analytics Dashboard',
  gameweek,
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
      options: ['All', 'Castle FC'],
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

const dashboardWidget = {
  widget_id: 'points-by-team',
  chart_type: 'bar',
  title: 'Points by team',
  series: [
    {
      metric_id: 'points',
      label: 'Points',
      points: [
        { label: 'Castle FC', value: 72, dimension_value: 'Castle FC', drilldown_key: 'team-castle' },
        { label: 'River Rangers', value: 64, dimension_value: 'River Rangers', drilldown_key: 'team-river' },
      ],
    },
  ],
  columns: [],
  rows: [],
  filters_applied: [{ filter_id: 'team-filter', value: 'All' }],
  validation_issues: [],
  empty: false,
  partial: false,
};

const fdrScale = [
  { rating: 1, band: 'very_easy', label: 'Very easy', foreground_token: 'var(--color-success)', background_token: 'var(--color-success-soft)', contrast_ratio: 4.8 },
  { rating: 3, band: 'medium', label: 'Medium', foreground_token: 'var(--color-warning)', background_token: 'var(--color-warning-soft)', contrast_ratio: 4.7 },
  { rating: 5, band: 'very_hard', label: 'Very hard', foreground_token: 'var(--color-danger)', background_token: 'var(--color-danger-soft)', contrast_ratio: 4.9 },
];

const fdrView = (view) => ({
  view,
  filters: { season: '2026', team_id: null, gameweek_start: 1, gameweek_end: 3 },
  scales: fdrScale,
  rows: [
    {
      team: teams[0],
      average_rating: 2.3,
      fixtures: [
        { id: 'fdr-1', opponent: teams[1], gameweek, venue: 'H', rating: 2, band: 'easy', abbreviation: 'RIV' },
      ],
    },
  ],
  available_teams: teams,
  available_gameweeks: [gameweek],
});

async function mockApi(page, authenticated = true) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/api/auth/session') {
      return route.fulfill({ json: authenticated ? screenshotSession : unauthenticatedScreenshotSession });
    }

    if (path === '/api/auth/google/config') {
      return route.fulfill({
        json: authenticated
          ? { enabled: false, client_id: null }
          : { enabled: true, client_id: 'screenshot-client' },
      });
    }

    if (path === '/api/squad/summary') {
      return route.fulfill({ json: screenshotSquadSummary });
    }

    if (path === '/api/scouting/players') {
      return route.fulfill({ json: screenshotScoutingPlayers });
    }

    if (path === '/api/interests') {
      return route.fulfill({ json: [] });
    }

    if (path === '/api/trades') {
      return route.fulfill({ json: { trades: [] } });
    }

    if (path === '/api/team-selection') {
      return route.fulfill({ json: screenshotTeamSelection });
    }

    if (path === '/api/team-selection/fixtures-summary') {
      return route.fulfill({ json: screenshotTeamSelectionFixtureSummary });
    }

    if (path === '/api/health' || path === '/health') {
      return route.fulfill({ json: { status: 'ok' } });
    }

    if (path === '/api/contracts/theme-presets') {
      return route.fulfill({ json: { presets: [] } });
    }

    if (path.startsWith('/api/dashboard/config')) {
      return route.fulfill({ json: dashboardConfig });
    }

    if (path.includes('/api/dashboard/widgets/') && path.endsWith('/query')) {
      return route.fulfill({ json: dashboardWidget });
    }

    if (path.includes('/api/dashboard/widgets/') && path.endsWith('/drilldown')) {
      return route.fulfill({ json: { widget_id: 'points-by-team', title: 'Team detail', context: {}, columns: [], rows: [] } });
    }

    if (path === '/api/fdr') {
      return route.fulfill({ json: { attack: fdrView('attack'), defence: fdrView('defence'), scales: fdrScale } });
    }

    if (path.includes('/api/league/fixtures')) {
      return route.fulfill({ json: { gameweek, fixtures: [fixture] } });
    }

    if (path === '/api/league/table') {
      return route.fulfill({
        json: {
          source: 'screenshot fixture',
          rows: [
            { position: 1, team: teams[0], played: 1, wins: 1, draws: 0, losses: 0, points_for: 72, points_against: 64, points_difference: 8, league_points: 3 },
            { position: 2, team: teams[1], played: 1, wins: 0, draws: 0, losses: 1, points_for: 64, points_against: 72, points_difference: -8, league_points: 0 },
          ],
        },
      });
    }

    if (path === '/api/league/knockout') {
      return route.fulfill({ json: { rounds: ['Semi-final'], matches: [{ id: 'ko-1', round_label: 'Semi-final', fixture, winner: teams[0] }] } });
    }

    if (path === '/api/league/head-to-head') {
      return route.fulfill({ json: { records: [{ team: teams[0], opponent: teams[1], played: 1, wins: 1, draws: 0, losses: 0, points_for: 72, points_against: 64 }] } });
    }

    return route.fulfill({ status: 404, json: { error: `No screenshot mock for ${path}` } });
  });
}

async function assertAccessibilityAndKeyboard(page, routeName, viewportName) {
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () => window.axe.run(document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
  }));

  const blockingViolations = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );

  if (blockingViolations.length > 0) {
    const summary = blockingViolations
      .map((violation) => {
        const targets = violation.nodes.flatMap((node) => node.target).join(', ');
        return `${violation.id} (${violation.impact}): ${targets}`;
      })
      .join('; ');

    throw new Error(`${routeName} at ${viewportName} has blocking accessibility violations: ${summary}`);
  }

  await page.keyboard.press('Tab');
  const keyboardFocus = await page.evaluate(() => {
    const element = document.activeElement;
    const rect = element?.getBoundingClientRect();

    return {
      focusVisible: Boolean(element?.matches(':focus-visible')),
      height: rect?.height ?? 0,
      name: element?.getAttribute('aria-label') ?? element?.textContent?.trim() ?? '',
      tagName: element?.tagName ?? '',
      width: rect?.width ?? 0,
    };
  });

  if (
    keyboardFocus.tagName === 'BODY'
    || keyboardFocus.name.length === 0
    || keyboardFocus.width <= 0
    || keyboardFocus.height <= 0
    || !keyboardFocus.focusVisible
  ) {
    throw new Error(
      `${routeName} at ${viewportName} did not expose a visible, named keyboard focus target: `
        + JSON.stringify(keyboardFocus),
    );
  }

  await page.evaluate(() => document.activeElement?.blur());
}

async function assertLayoutSafety(page, routeName, viewportName) {
  await page.evaluate(() => document.fonts.ready);

  const mainCount = await page.locator('main').count();
  if (mainCount === 0) {
    throw new Error(`${routeName} at ${viewportName} has no main landmark`);
  }

  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  if (overflow.scrollWidth > overflow.clientWidth + 1) {
    throw new Error(
      `${routeName} at ${viewportName} overflows horizontally: ` +
        `${overflow.scrollWidth}px content in ${overflow.clientWidth}px viewport`,
    );
  }
}

async function capture() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch();

  for (const viewport of viewports) {
    const viewportDir = `${outputDir}/${viewport.name}`;
    await mkdir(viewportDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
    });
    const page = await context.newPage();
    await mockApi(page);

    for (const [name, route] of routes) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await assertAccessibilityAndKeyboard(page, name, viewport.name);
      await assertLayoutSafety(page, name, viewport.name);
      await page.screenshot({ path: `${viewportDir}/${name}.png`, fullPage: true });
    }

    await context.close();

    const loginContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
    });
    const loginPage = await loginContext.newPage();
    await loginPage.route('https://accounts.google.com/gsi/client', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `window.google = { accounts: { id: {
          initialize() {},
          renderButton(parent) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Sign in with Google';
            button.setAttribute('aria-label', 'Sign in with Google');
            button.style.width = '100%';
            button.style.minHeight = '44px';
            button.style.border = '1px solid rgba(148, 163, 184, 0.35)';
            button.style.borderRadius = '12px';
            button.style.background = '#ffffff';
            button.style.color = '#172033';
            button.style.fontWeight = '700';
            button.style.cursor = 'pointer';
            parent.append(button);
          },
        } } };`,
      });
    });
    await mockApi(loginPage, false);
    await loginPage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    await loginPage.getByRole('heading', { name: 'Welcome back' }).waitFor();
    await loginPage.getByRole('button', { name: 'Sign in with Google' }).waitFor();
    await assertAccessibilityAndKeyboard(loginPage, 'login', viewport.name);
    await assertLayoutSafety(loginPage, 'login', viewport.name);
    await loginPage.screenshot({ path: `${viewportDir}/login.png`, fullPage: true });
    await loginContext.close();
  }

  await browser.close();
}

capture().catch((error) => {
  console.error(error);
  process.exit(1);
});
