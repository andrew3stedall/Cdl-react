import type {
  DashboardClient,
  DashboardConfig,
  DashboardDrilldownResponse,
  WidgetQueryResponse,
} from './dashboard-api';
import type { FdrClient, FdrCombinedResponse, FdrFilters } from './fdr-api';
import type { LeagueClient, LeagueFixture, LeagueSnapshot, LeagueTeam } from './league-api';
import { LocalStoragePreferenceClient } from './preferences-api';
import type {
  SquadApiHistoryResponse,
  SquadApiSummary,
  SquadClient,
} from './squad-api';
import type { TeamSelectionClient, TeamSelectionFixtureSummary, TeamSelectionPlayer, TeamSelectionSnapshot } from './team-selection-api';

const teams: LeagueTeam[] = [
  { id: 'castle-fc', name: 'Castle FC', shortName: 'CAS' },
  { id: 'river-rangers', name: 'River Rangers', shortName: 'RIV' },
  { id: 'harbour-athletic', name: 'Harbour Athletic', shortName: 'HAR' },
];

const currentGameweek = { id: 'gw-12', name: 'Gameweek 12', number: 12, deadlineAt: '2026-08-14T17:30:00Z' };
const nextGameweek = { id: 'gw-13', name: 'Gameweek 13', number: 13, deadlineAt: '2026-08-21T17:30:00Z' };

const currentFixture: LeagueFixture = {
  id: 'fixture-12-1',
  gameweek: currentGameweek,
  homeTeam: teams[0],
  awayTeam: teams[1],
  status: 'complete',
  kickoffLabel: 'Sat 15:00',
  roundLabel: 'League',
  isCurrent: true,
  isNext: false,
  detailAvailable: true,
  score: {
    homeScore: 72,
    awayScore: 64,
    bonusPoints: { 'castle-fc': 3 },
    chipsPlayed: { 'castle-fc': ['wildcard'] },
    outcome: 'home_win',
  },
};

const nextFixture: LeagueFixture = {
  ...currentFixture,
  id: 'fixture-13-1',
  gameweek: nextGameweek,
  homeTeam: teams[2],
  awayTeam: teams[0],
  status: 'pending',
  kickoffLabel: 'Sun 16:30',
  isCurrent: false,
  isNext: true,
  score: {
    homeScore: null,
    awayScore: null,
    bonusPoints: {},
    chipsPlayed: {},
    outcome: 'pending',
  },
};

const additionalCurrentFixture: LeagueFixture = {
  ...currentFixture,
  id: 'fixture-12-2',
  homeTeam: teams[2],
  awayTeam: teams[0],
  score: {
    homeScore: 58,
    awayScore: 61,
    bonusPoints: { 'castle-fc': 1 },
    chipsPlayed: {},
    outcome: 'away_win',
  },
};

const additionalNextFixture: LeagueFixture = {
  ...nextFixture,
  id: 'fixture-13-2',
  homeTeam: teams[1],
  awayTeam: teams[2],
};

const dashboardConfig: DashboardConfig = {
  id: 'pages-preview-dashboard',
  title: 'Manager Analytics Dashboard',
  gameweek: currentGameweek,
  metrics: [
    {
      id: 'points',
      label: 'Points',
      description: 'Total manager points.',
      aggregation: 'sum',
      format: 'points',
    },
  ],
  dimensions: [
    {
      id: 'team',
      label: 'Team',
      description: 'Draft team.',
      values: teams.map((team) => team.name),
    },
  ],
  filters: [
    {
      id: 'team-filter',
      label: 'Team',
      dimensionId: 'team',
      scope: 'global',
      options: ['All', ...teams.map((team) => team.name)],
      defaultValue: 'All',
    },
  ],
  widgets: [
    {
      id: 'points-by-team',
      title: 'Points by team',
      description: 'Static preview of current gameweek scoring.',
      chartType: 'bar',
      metricId: 'points',
      dimensionId: 'team',
      filterIds: ['team-filter'],
      supportsDrilldown: true,
      sort: 'desc',
    },
  ],
};

const dashboardWidget: WidgetQueryResponse = {
  widgetId: 'points-by-team',
  chartType: 'bar',
  title: 'Points by team',
  series: [
    {
      metricId: 'points',
      label: 'Points',
      points: [
        { label: 'Castle FC', value: 72, dimensionValue: 'Castle FC', drilldownKey: 'castle-fc' },
        { label: 'River Rangers', value: 64, dimensionValue: 'River Rangers', drilldownKey: 'river-rangers' },
        {
          label: 'Harbour Athletic',
          value: 58,
          dimensionValue: 'Harbour Athletic',
          drilldownKey: 'harbour-athletic',
        },
      ],
    },
  ],
  columns: [],
  rows: [],
  filtersApplied: [{ filterId: 'team-filter', value: 'All' }],
  validationIssues: [],
  empty: false,
  partial: false,
};

export const staticPreviewDashboardClient: DashboardClient = {
  async getConfig() {
    return dashboardConfig;
  },
  async queryWidget() {
    return dashboardWidget;
  },
  async drilldown(): Promise<DashboardDrilldownResponse> {
    return {
      widgetId: 'points-by-team',
      title: 'Team detail',
      context: { source: 'GitHub Pages static preview' },
      columns: [
        { id: 'team', label: 'Team', align: 'left' },
        { id: 'points', label: 'Points', align: 'right' },
      ],
      rows: [{ cells: { team: 'Castle FC', points: 72 } }],
    };
  },
};

export const staticPreviewLeagueClient: LeagueClient = {
  async getLeagueSnapshot(): Promise<LeagueSnapshot> {
    return {
      currentFixtures: { gameweek: currentGameweek, fixtures: [currentFixture, additionalCurrentFixture] },
      nextFixtures: { gameweek: nextGameweek, fixtures: [nextFixture, additionalNextFixture] },
      allFixtures: { gameweek: currentGameweek, fixtures: [currentFixture, additionalCurrentFixture, nextFixture, additionalNextFixture] },
      table: {
        source: 'GitHub Pages static preview',
        rows: [
          {
            position: 1,
            team: teams[0],
            played: 1,
            wins: 1,
            draws: 0,
            losses: 0,
            pointsFor: 72,
            pointsAgainst: 64,
            pointsDifference: 8,
            leaguePoints: 3,
          },
          {
            position: 2,
            team: teams[1],
            played: 1,
            wins: 0,
            draws: 0,
            losses: 1,
            pointsFor: 64,
            pointsAgainst: 72,
            pointsDifference: -8,
            leaguePoints: 0,
          },
        ],
      },
      knockout: {
        rounds: ['Semi-final'],
        matches: [{ id: 'ko-1', roundLabel: 'Semi-final', fixture: currentFixture, winner: teams[0] }],
      },
      headToHead: {
        records: [
          {
            team: teams[0],
            opponent: teams[1],
            played: 1,
            wins: 1,
            draws: 0,
            losses: 0,
            pointsFor: 72,
            pointsAgainst: 64,
          },
        ],
      },
    };
  },
  async getFixtureDetail(fixtureId) {
    return {
      fixture: { ...currentFixture, id: fixtureId },
      events: [
        { label: 'Bonus points awarded', team: teams[0], points: 3, ruleReference: 'league-table' },
        { label: 'Chip impact recorded', team: teams[0], points: 0, ruleReference: 'chip-use' },
      ],
      notes: ['Started fixtures expose detail data once scoring is available.'],
    };
  },
};

const gameweeks = [currentGameweek, nextGameweek, { id: 'gw-14', name: 'Gameweek 14', number: 14 }];
const scales = [
  {
    rating: 1,
    band: 'very_easy' as const,
    label: 'Very easy',
    foregroundToken: 'var(--cdl-foreground)',
    backgroundToken: 'var(--cdl-surface)',
    contrastRatio: 4.8,
  },
  {
    rating: 3,
    band: 'medium' as const,
    label: 'Medium',
    foregroundToken: 'var(--cdl-foreground)',
    backgroundToken: 'var(--cdl-surface)',
    contrastRatio: 4.8,
  },
  {
    rating: 5,
    band: 'very_hard' as const,
    label: 'Very hard',
    foregroundToken: 'var(--cdl-foreground)',
    backgroundToken: 'var(--cdl-surface)',
    contrastRatio: 4.8,
  },
];

export const staticPreviewFdrClient: FdrClient = {
  async getFdr(filters: FdrFilters): Promise<FdrCombinedResponse> {
    const rows = teams.map((team, teamIndex) => ({
      team,
      averageRating: 2 + teamIndex,
      fixtures: gameweeks.map((gameweek, fixtureIndex) => {
        const rating = Math.min(5, Math.max(1, 2 + teamIndex + fixtureIndex));
        return {
          id: `${team.id}-${gameweek.id}`,
          opponent: teams[(teamIndex + fixtureIndex + 1) % teams.length],
          gameweek,
          venue: fixtureIndex % 2 === 0 ? 'H' : 'A',
          rating,
          band: rating >= 5 ? ('very_hard' as const) : rating >= 3 ? ('medium' as const) : ('easy' as const),
          abbreviation: teams[(teamIndex + fixtureIndex + 1) % teams.length].shortName ?? 'OPP',
        };
      }),
    }));

    const response = {
      filters,
      scales,
      rows,
      availableTeams: teams,
      availableGameweeks: gameweeks,
    };

    return {
      attack: { ...response, view: 'attack' },
      defence: { ...response, view: 'defence' },
      scales,
    };
  },
};

export const staticPreviewPreferenceClient = new LocalStoragePreferenceClient();


const staticTeamSelectionSnapshot: TeamSelectionSnapshot = {
  managerTeam: { id: 'castle-fc', name: 'Castle FC', shortName: 'CAS' },
  gameweek: currentGameweek,
  players: [
    { id: 'player-1', name: 'Alex Keeper', position: 'GKP', team: 'ARS', slot: 'starter', slotOrder: 1, captain: false, viceCaptain: false },
    { id: 'player-2', name: 'Ben Defender', position: 'DEF', team: 'MCI', slot: 'starter', slotOrder: 2, captain: false, viceCaptain: false },
    { id: 'player-3', name: 'Casey Midfielder', position: 'MID', team: 'ARS', slot: 'starter', slotOrder: 3, captain: true, viceCaptain: false },
    { id: 'player-4', name: 'Riley Forward', position: 'FWD', team: 'MCI', slot: 'bench', slotOrder: 1, captain: false, viceCaptain: true },
    { id: 'player-5', name: 'Morgan Reserve', position: 'MID', team: 'ARS', slot: 'reserve', slotOrder: 1, captain: false, viceCaptain: false },
  ],
  chips: [
    { id: 'triple-captain', name: 'Triple Captain', status: 'available' },
    { id: 'dual-captain', name: 'Dual Captain', status: 'available' },
    { id: 'auto-captain', name: 'Auto Captain', status: 'available' },
    { id: 'bench-boost', name: 'Bench Boost', status: 'used' },
    { id: 'best-xi', name: 'Best XI', status: 'available' },
  ],
  fixtureLock: { locked: false, fixtureId: null, fixtureType: null, lockScope: null, lockedAt: null, reason: null },
};

const staticTeamSelectionFixtureSummary: TeamSelectionFixtureSummary = {
  cdlFixtures: [{
    id: currentFixture.id,
    gameweek: currentFixture.gameweek,
    homeTeam: currentFixture.homeTeam,
    awayTeam: currentFixture.awayTeam,
    status: currentFixture.status,
  }],
  eplFixtures: [{
    id: 'epl-preview-fixture',
    gameweek: currentGameweek,
    homeTeam: { id: 'epl-ars', name: 'Arsenal', shortName: 'ARS' },
    awayTeam: { id: 'epl-mci', name: 'Manchester City', shortName: 'MCI' },
    status: 'scheduled',
  }],
  cdlTable: teams,
  eplTable: [
    { id: 'epl-ars', name: 'Arsenal', shortName: 'ARS' },
    { id: 'epl-mci', name: 'Manchester City', shortName: 'MCI' },
  ],
};

export const staticPreviewTeamSelectionClient: TeamSelectionClient = {
  async getTeamSelection() {
    return structuredClone(staticTeamSelectionSnapshot);
  },
  async getFixtureSummary() {
    return structuredClone(staticTeamSelectionFixtureSummary);
  },
  async saveLineup(players: TeamSelectionPlayer[]) {
    return { ...structuredClone(staticTeamSelectionSnapshot), players: structuredClone(players) };
  },
  async updateChip(chipId: string, active: boolean) {
    return {
      ...structuredClone(staticTeamSelectionSnapshot),
      chips: staticTeamSelectionSnapshot.chips.map((chip) =>
        chip.id === chipId ? { ...chip, status: active ? 'active' : 'available' } : chip,
      ),
    };
  },
};

const staticPreviewSquadSummary: SquadApiSummary = {
  manager_team: { id: 'castle-fc', name: 'Castle FC', short_name: 'CAS' },
  gameweek: {
    id: currentGameweek.id,
    name: currentGameweek.name,
    number: currentGameweek.number,
    deadline_at: '2026-08-14T17:30:00Z',
  },
  players: [
    {
      id: 'player-1',
      display_name: 'Alex Keeper',
      position: 'GKP',
      epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' },
      status: 'owned',
      points: 48,
      form: 6.1,
      value: 5,
      availability_status: 'available',
      chance_of_playing_next_round: 100,
      next_fixture: {
        fixture_id: 'preview-fixture-1',
        opponent: { id: 'epl-riv', name: 'River Rangers', short_name: 'RIV' },
        is_home: true,
        difficulty: 2,
      },
    },
    {
      id: 'player-2',
      display_name: 'Ben Defender',
      position: 'DEF',
      epl_team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' },
      status: 'owned',
      points: 55,
      form: 5.8,
      value: 6.2,
      availability_status: 'available',
      chance_of_playing_next_round: 100,
      next_fixture: {
        fixture_id: 'preview-fixture-2',
        opponent: { id: 'epl-riv', name: 'River Rangers', short_name: 'RIV' },
        is_home: false,
        difficulty: 3,
      },
    },
    {
      id: 'player-3',
      display_name: 'Casey Midfielder',
      position: 'MID',
      epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' },
      status: 'owned',
      points: 61,
      form: 7.2,
      value: 7.5,
      availability_status: 'available',
      chance_of_playing_next_round: 100,
      next_fixture: {
        fixture_id: 'preview-fixture-3',
        opponent: { id: 'epl-riv', name: 'River Rangers', short_name: 'RIV' },
        is_home: true,
        difficulty: 2,
      },
    },
    {
      id: 'player-4',
      display_name: 'Riley Forward',
      position: 'FWD',
      epl_team: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' },
      status: 'owned',
      points: 72,
      form: 8.3,
      value: 13.8,
      availability_status: 'doubtful',
      availability_news: 'Late fitness test',
      chance_of_playing_next_round: 75,
      next_fixture: {
        fixture_id: 'preview-fixture-4',
        opponent: { id: 'epl-riv', name: 'River Rangers', short_name: 'RIV' },
        is_home: false,
        difficulty: 3,
      },
    },
  ],
};

export const staticPreviewSquadClient: SquadClient = {
  async getWorkspace() {
    return {
      summary: structuredClone(staticPreviewSquadSummary),
      notifications: {
        notifications: [{
          id: 'preview-notification-1',
          title: 'Fixture difficulty updated',
          message: 'Review the upcoming fixture run before making your next transfer.',
          action_href: '/fdr',
          kind: 'fixture_difficulty',
        }],
        proposed_trade_count: 0,
      },
    };
  },
  async getSummary() {
    return structuredClone(staticPreviewSquadSummary);
  },
  async getScoutingPlayers() {
    return { players: structuredClone(staticPreviewSquadSummary.players) };
  },
  async getPlayer(playerId: string) {
    return structuredClone(
      staticPreviewSquadSummary.players.find((player) => player.id === playerId)
      ?? staticPreviewSquadSummary.players[0],
    );
  },
  async getTrades() {
    return { trades: [] };
  },
  async getChanges() {
    return { available_to_add: [] };
  },
  async getNotifications() {
    return {
      notifications: [{
        id: 'preview-notification-1',
        title: 'Fixture difficulty updated',
        message: 'Review the upcoming fixture run before making your next transfer.',
        action_href: '/fdr',
        kind: 'fixture_difficulty',
      }],
      proposed_trade_count: 0,
    };
  },
  async getPlayerHistory(): Promise<SquadApiHistoryResponse> {
    return {
      player_id: 'preview-player',
      fetched_at: '2026-08-09T00:00:00Z',
      response_sha256: 'static-preview',
      history: [],
      fixtures: [],
    };
  },
  async createTrade() {
    return { id: 'preview-trade', status: 'proposed' };
  },
  async applyChanges(): Promise<SquadApiSummary> {
    return structuredClone(staticPreviewSquadSummary);
  },
};
