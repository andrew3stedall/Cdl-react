import type { Page } from '@playwright/test';

const team = { id: 'team-browser-fixture', name: 'Browser Fixture FC', short_name: 'BFC' };
const gameweek = { id: 'gw-browser-fixture', name: 'Matchweek 1', number: 1, deadline_at: '2099-01-01T00:00:00Z' };
const positions = [
  'GKP', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD',
  'GKP', 'DEF', 'MID', 'FWD', 'GKP', 'DEF', 'MID',
];

const lineup = positions.map((position, index) => ({
  id: `player-${index + 1}`,
  display_name: `Fixture Player ${index + 1}`,
  position,
  epl_team: { id: `club-${index % 4}`, name: `Club ${index % 4}`, short_name: `C${index % 4}` },
  slot: index < 11 ? 'starter' : index < 16 ? 'bench' : 'reserve',
  slot_order: index < 11
    ? index + 1
    : index < 16
      ? ([1, 2, 0, 3, 4][index - 11] ?? 0)
      : index - 15,
  is_captain: index === 0,
  is_vice_captain: index === 1,
}));

const chips = [
  { id: 'triple-captain', name: 'Triple Captain', status: 'available' },
  { id: 'dual-captain', name: 'Dual Captain', status: 'available' },
  { id: 'auto-captain', name: 'Auto Captain', status: 'available' },
  { id: 'bench-boost', name: 'Bench Boost', status: 'available' },
  { id: 'best-xi', name: 'Best XI', status: 'available' },
];

const squadPlayers = lineup.map((player, index) => ({
  ...player,
  status: 'owned',
  points: 50 + index,
  form: 5.1 + index / 10,
  value: 5 + index / 10,
  selected_by_percent: 12 + index,
  expected_goals: 0.2 + index / 100,
  expected_assists: 0.1 + index / 100,
  availability_status: 'a',
  availability_news: '',
  chance_of_playing_next_round: 100,
  next_fixture: {
    fixture_id: 'fixture-browser-1',
    gameweek,
    opponent: { id: 'club-next', name: 'Next Club', short_name: 'NXT' },
    difficulty: 3,
    is_home: index % 2 === 0,
  },
}));

const teamSelection = {
  manager_team: team,
  gameweek,
  lineup,
  chips,
  validation_messages: [],
  fixture_lock: { locked: false, fixture_id: null, fixture_type: null, lock_scope: null, locked_at: null, reason: null },
};

const workspace = {
  summary: { manager_team: team, gameweek, players: squadPlayers },
  notifications: { notifications: [], proposed_trade_count: 0 },
};

const fixture = {
  id: 'fixture-browser-1',
  gameweek,
  home_team: team,
  away_team: { id: 'team-river', name: 'River Rangers', short_name: 'RIV' },
  status: 'pending',
  kickoff_label: 'Sat 15:00',
  round_label: 'League',
  is_current: false,
  is_next: true,
  detail_available: true,
  score: { home_score: null, away_score: null, bonus_points: {}, chips_played: {}, outcome: 'pending' },
};

const fixtureList = { gameweek, fixtures: [fixture] };
const leagueFixtureData = {
  current: fixtureList,
  next: { gameweek: { ...gameweek, id: 'gw-browser-next', name: 'Matchweek 2', number: 2 }, fixtures: [] },
  all: fixtureList,
  table: { source: 'browser-fixture', rows: [{
    position: 1, team, played: 1, wins: 1, draws: 0, losses: 0,
    points_for: 68, points_against: 44, points_difference: 24, league_points: 3,
  }] },
  knockout: { rounds: [], matches: [] },
  headToHead: { records: [] },
};

const desk = {
  context: 'pre_deadline',
  gameweek,
  selection: teamSelection,
  squad: workspace,
  current_fixture: null,
  next_fixture: fixture,
  current_fixtures: [],
  next_fixtures: [fixture],
  recent_fixtures: [],
  form_fixtures: [],
  league_table: leagueFixtureData.table,
  available_players: [],
};

const marketPlayer = {
  ...squadPlayers[0],
  id: 'market-player-1',
  display_name: 'Fixture Available Midfielder',
  position: 'MID',
  status: 'available',
  points: 61,
  form: 6.8,
  value: 7.5,
};

export async function installLayoutFixtures(
  page: Page,
  { apiDelayMs = 0, holdDataUntilReleased = false, roles = ['manager'] }: { apiDelayMs?: number; holdDataUntilReleased?: boolean; roles?: string[] } = {},
) {
  let releasePendingResponses!: () => void;
  const pendingResponses = new Promise<void>((resolve) => { releasePendingResponses = resolve; });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const getResponse = (body: unknown) => route.fulfill({ json: body });

    if (path === '/api/me/preferences') {
      const cookie = route.request().headers().cookie ?? '';
      const storedPreset = cookie.match(/(?:^|;\s*)cdl-theme-preset=([^;]+)/)?.[1];
      return await getResponse({ theme_preset: storedPreset ? decodeURIComponent(storedPreset) : 'teal-dark' });
    }

    if (path === '/api/auth/session') {
      await getResponse({
        is_authenticated: true,
        user: {
          id: 'layout-manager',
          email: 'layout@example.test',
          display_name: 'Layout Fixture',
          roles,
        },
        expires_at: '2099-01-01T00:00:00Z',
      });
      return;
    }
    if (path === '/api/auth/google/config') return await getResponse({ enabled: false, client_id: null });
    if (path === '/api/auth/apple/config') return await getResponse({ enabled: false });
    if (path === '/api/auth/passkeys/config') return await getResponse({ enabled: false, rp_id: null });
    if (path === '/api/squad/notifications') return await getResponse(workspace.notifications);

    if (holdDataUntilReleased) await pendingResponses;
    else if (apiDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, apiDelayMs));
    if (path === '/api/desk') return await getResponse(desk);
    if (path === '/api/team-selection' || path === '/api/team-selection/lineup' || path.startsWith('/api/team-selection/chips/')) {
      return await getResponse(teamSelection);
    }
    if (path === '/api/team-selection/fixtures-summary') {
      return await getResponse({ cdl_fixtures: [], epl_fixtures: [], cdl_table: [], epl_table: [] });
    }
    if (path === '/api/squad/workspace') return await getResponse(workspace);
    if (path === '/api/squad/summary') return await getResponse(workspace.summary);
    if (path === '/api/scouting/players') return await getResponse({ players: [marketPlayer] });
    if (path === '/api/interests') return await getResponse([]);
    if (path === '/api/trades') return await getResponse({ trades: [] });
    if (path === '/api/league/fixtures/current') return await getResponse(leagueFixtureData.current);
    if (path === '/api/league/fixtures/next') return await getResponse(leagueFixtureData.next);
    if (path === '/api/league/fixtures') return await getResponse(leagueFixtureData.all);
    if (path === '/api/league/table') return await getResponse(leagueFixtureData.table);
    if (path === '/api/league/knockout') return await getResponse(leagueFixtureData.knockout);
    if (path === '/api/league/head-to-head') return await getResponse(leagueFixtureData.headToHead);
    if (path === '/api/league/management') {
      return await getResponse({ league_name: 'Browser Fixture League', available_team_count: 1, teams: [{
        team_id: 'team-open', team_name: 'Open Team', manager_name: null, manager_email: null, is_assigned: false,
      }] });
    }
    if (path.startsWith('/api/fpl/players/')) return await getResponse({ history: [], fixtures: [] });
    return await getResponse({});
  });
  return { releasePendingResponses };
}
