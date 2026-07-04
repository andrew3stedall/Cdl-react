import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.APP_PREVIEW_URL ?? 'http://127.0.0.1:5173';
const outputDir = process.env.SCREENSHOT_DIR ?? 'artifacts/app-screenshots';

const routes = [
  ['home-rules', '/'],
  ['league', '/league'],
  ['dashboard', '/dashboard'],
  ['fdr', '/fdr'],
  ['squad-management', '/squad-management'],
  ['team-selection', '/team-selection'],
];

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

async function capture() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await mockApi(page);

  for (const [name, route] of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${outputDir}/${name}.png`, fullPage: true });
  }

  await browser.close();
}

capture().catch((error) => {
  console.error(error);
  process.exit(1);
});
