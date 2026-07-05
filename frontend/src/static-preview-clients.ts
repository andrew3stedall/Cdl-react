import type {
  DashboardClient,
  DashboardConfig,
  DashboardDrilldownResponse,
  WidgetQueryResponse,
} from './dashboard-api';
import type { FdrClient, FdrCombinedResponse, FdrFilters } from './fdr-api';
import type { LeagueClient, LeagueFixture, LeagueSnapshot, LeagueTeam } from './league-api';
import { LocalStoragePreferenceClient } from './preferences-api';

const teams: LeagueTeam[] = [
  { id: 'castle-fc', name: 'Castle FC', shortName: 'CAS' },
  { id: 'river-rangers', name: 'River Rangers', shortName: 'RIV' },
  { id: 'harbour-athletic', name: 'Harbour Athletic', shortName: 'HAR' },
];

const currentGameweek = { id: 'gw-12', name: 'Gameweek 12', number: 12 };
const nextGameweek = { id: 'gw-13', name: 'Gameweek 13', number: 13 };

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
      currentFixtures: { gameweek: currentGameweek, fixtures: [currentFixture] },
      nextFixtures: { gameweek: nextGameweek, fixtures: [nextFixture] },
      allFixtures: { gameweek: currentGameweek, fixtures: [currentFixture, nextFixture] },
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
