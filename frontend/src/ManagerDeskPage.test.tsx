import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import type { SessionState } from './contracts';
import { ManagerDeskPage } from './ManagerDeskPage';
import type { LeagueClient, LeagueFixture, LeagueSnapshot } from './league-api';
import type { ManagerDeskClient, ManagerDeskSnapshot } from './manager-desk-api';
import type {
  SquadApiHistoryResponse,
  SquadApiSummary,
  SquadClient,
} from './squad-api';
import type { TeamSelectionClient, TeamSelectionSnapshot } from './team-selection-api';
import { ThemePresetProvider } from './theme-preset-provider';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const session: SessionState = {
  isAuthenticated: true,
  user: {
    id: 'manager-1',
    email: 'manager@example.com',
    displayName: 'Alex Manager',
    roles: ['manager'],
  },
  expiresAt: null,
};

const selection: TeamSelectionSnapshot = {
  managerTeam: { id: 'team-castle', name: 'Castle FC', shortName: 'CAS' },
  gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1, deadlineAt: '2030-08-14T17:30:00Z' },
  players: [
    { id: 'p1', name: 'Alex Keeper', position: 'GKP', team: 'ARS', slot: 'starter', slotOrder: 1, captain: true, viceCaptain: false },
    { id: 'p2', name: 'Ben Defender', position: 'DEF', team: 'MCI', slot: 'starter', slotOrder: 2, captain: false, viceCaptain: false },
  ],
  chips: [],
  fixtureLock: { locked: false, fixtureId: null, fixtureType: null, lockScope: null, lockedAt: null, reason: null },
};

const league: LeagueSnapshot = {
  currentFixtures: { gameweek: selection.gameweek, fixtures: [] },
  nextFixtures: {
    gameweek: { id: 'gw-2', name: 'Gameweek 2', number: 2 },
    fixtures: [{
      id: 'fixture-1',
      gameweek: { id: 'gw-2', name: 'Gameweek 2', number: 2 },
      homeTeam: { id: 'team-castle', name: 'Castle FC', shortName: 'CAS' },
      awayTeam: { id: 'team-river', name: 'River Rangers', shortName: 'RIV' },
      status: 'pending',
      kickoffLabel: 'Sat 15:00',
      roundLabel: 'League',
      isCurrent: false,
      isNext: true,
      detailAvailable: true,
      score: { homeScore: null, awayScore: null, bonusPoints: {}, chipsPlayed: {}, outcome: 'pending' },
    }],
  },
  allFixtures: { gameweek: null, fixtures: [] },
  table: {
    source: 'test',
    rows: [{
      position: 2,
      team: { id: 'team-castle', name: 'Castle FC', shortName: 'CAS' },
      played: 1,
      wins: 1,
      draws: 0,
      losses: 0,
      pointsFor: 72,
      pointsAgainst: 64,
      pointsDifference: 8,
      leaguePoints: 3,
    }],
  },
  knockout: { rounds: [], matches: [] },
  headToHead: { records: [] },
};

const squad: SquadApiSummary = {
  manager_team: { id: 'team-castle', name: 'Castle FC', short_name: 'CAS' },
  gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
  players: [{
    id: 'p1',
    display_name: 'Alex Keeper',
    position: 'GKP',
    epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' },
    status: 'owned',
    points: 48,
    value: 5,
    availability_status: 'doubtful',
    availability_news: 'Late fitness test',
    chance_of_playing_next_round: 75,
  }],
};

class MemoryTeamSelectionClient implements TeamSelectionClient {
  async getTeamSelection() { return selection; }
  async getFixtureSummary() { return { cdlFixtures: [], eplFixtures: [], cdlTable: [], eplTable: [] }; }
  async saveLineup() { return selection; }
  async updateChip() { return selection; }
}

class MemoryLeagueClient implements LeagueClient {
  async getLeagueSnapshot() { return league; }
}

class MemorySquadClient implements SquadClient {
  constructor(private readonly summary: SquadApiSummary = squad) {}

  async getWorkspace() {
    return {
      summary: this.summary,
      notifications: {
        notifications: [{
          id: 'notification-1',
          title: 'Review fixture difficulty',
          message: 'Your next run has changed.',
          action_href: '/fdr',
          kind: 'fixture_difficulty',
        }],
        proposed_trade_count: 0,
      },
    };
  }
  async getSummary() { return this.summary; }
  async getScoutingPlayers() { return { players: this.summary.players }; }
  async getPlayer(playerId: string) { return this.summary.players.find((player) => player.id === playerId) ?? this.summary.players[0]; }
  async getTrades() { return { trades: [] }; }
  async getChanges() { return { available_to_add: [] }; }
  async getNotifications() {
    return {
      notifications: [{
        id: 'notification-1',
        title: 'Review fixture difficulty',
        message: 'Your next run has changed.',
        action_href: '/fdr',
        kind: 'fixture_difficulty',
      }],
      proposed_trade_count: 0,
    };
  }
  async getPlayerHistory(): Promise<SquadApiHistoryResponse> {
    return { player_id: 'p1', fetched_at: '2030-01-01', response_sha256: 'test', history: [], fixtures: [] };
  }
  async createTrade() { return { id: 'trade-1', status: 'proposed' }; }
  async applyChanges() { return this.summary; }
}

function scoredFixture(
  gameweekNumber: number,
  homeScore: number,
  awayScore: number,
  outcome: LeagueFixture['score']['outcome'],
  bonusPoints: Record<string, number> = {},
): LeagueFixture {
  return {
    id: `fixture-${gameweekNumber}`,
    gameweek: { id: `gw-${gameweekNumber}`, name: `Gameweek ${gameweekNumber}`, number: gameweekNumber },
    homeTeam: { id: 'team-stan-still-sells-tik', name: 'Stan Still Sells Tik', shortName: 'SSS' },
    awayTeam: { id: 'team-wilde-boars', name: 'Wilde Boars', shortName: 'WIL' },
    status: gameweekNumber === 5 ? 'started' : 'complete',
    kickoffLabel: 'Live now',
    roundLabel: 'League',
    isCurrent: gameweekNumber === 5,
    isNext: false,
    detailAvailable: true,
    score: { homeScore, awayScore, bonusPoints, chipsPlayed: {}, outcome },
  };
}

class MemoryManagerDeskClient implements ManagerDeskClient {
  constructor(private readonly snapshot: ManagerDeskSnapshot) {}

  async getDesk() { return this.snapshot; }
}

function renderPage(
  onNavigate: (href: string) => void = () => undefined,
  squadClient: SquadClient = new MemorySquadClient(),
  onSignOut: () => void = () => undefined,
  deskClient?: ManagerDeskClient,
) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ThemePresetProvider initialPresetName="teal-light">
        <ManagerDeskPage
        deskClient={deskClient}
        leagueClient={new MemoryLeagueClient()}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        session={session}
        squadClient={squadClient}
        teamSelectionClient={new MemoryTeamSelectionClient()}
        />
      </ThemePresetProvider>,
    );
  });
  return { container, root };
}

describe('ManagerDeskPage', () => {
  test('combines manager APIs into an actionable landing page', async () => {
    const destinations: string[] = [];
    const { container } = renderPage((href) => destinations.push(href));

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('h1')?.textContent).toBe('Team');
    expect(container.textContent).not.toContain('Manager workspace');
    expect(container.textContent).not.toContain('Good to see you, Alex');
    expect(container.querySelector('.cdl-page-hero h1')?.textContent).toBe('Team');
    expect(container.querySelector('.cdl-page-hero__context')).toBeNull();
    expect(container.querySelector('button[aria-label="Team"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.cdl-page-hero .manager-account-menu')).not.toBeNull();
    expect(container.textContent).toContain('Review your starting XI');
    expect(container.textContent).toContain('Check squad availability');
    expect(container.textContent).toContain('Review fixture difficulty');
    expect(container.textContent).toContain('River Rangers');
    expect(container.textContent).not.toContain('Quick actions');
    expect(container.textContent).not.toContain('Shortcuts');
    expect(container.textContent).not.toContain('Refresh data');
    expect(container.querySelector('[aria-label="Account settings"]')).toBeNull();
    expect(container.querySelector('[aria-label="Account menu for Alex Manager"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Account menu"]')?.textContent).toContain('Profile');

    const teamButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Review team'));
    await act(async () => {
      teamButton?.click();
    });
    expect(destinations).toContain('/team-selection');
  });

  test('uses nicknames and stacked score history on the combined fixture surface', async () => {
    const formFixtures = [
      scoredFixture(1, 20, 10, 'home_win'),
      scoredFixture(2, 12, 12, 'draw', { 'team-stan-still-sells-tik': 2 }),
      scoredFixture(3, 8, 14, 'away_win', { 'team-stan-still-sells-tik': -1 }),
      scoredFixture(4, 31, 22, 'home_win'),
      scoredFixture(5, 24, 20, 'home_win'),
    ];
    const currentFixture = formFixtures[4];
    const otherFixture: LeagueFixture = {
      ...currentFixture,
      id: 'fixture-other',
      homeTeam: { id: 'team-bayer-neverlusen', name: 'Bayer Neverlusen' },
      awayTeam: { id: 'team-class-of-84', name: 'Class of 84' },
      status: 'complete',
      isCurrent: false,
      score: { homeScore: 43, awayScore: 6, bonusPoints: {}, chipsPlayed: {}, outcome: 'home_win' },
    };
    const liveSelection = { ...selection, managerTeam: { id: 'team-stan-still-sells-tik', name: 'Stan Still Sells Tik' } };
    const liveSnapshot: ManagerDeskSnapshot = {
      context: 'live',
      gameweek: currentFixture.gameweek,
      selection: liveSelection,
      squad: { summary: { ...squad, manager_team: { id: 'team-stan-still-sells-tik', name: 'Stan Still Sells Tik' } }, notifications: { notifications: [], proposed_trade_count: 0 } },
      currentFixture,
      nextFixture: null,
      currentFixtures: [currentFixture, otherFixture],
      nextFixtures: [],
      recentFixtures: formFixtures,
      formFixtures,
      leagueTable: league.table,
      availablePlayers: [],
      drawDeadlineAt: null,
      interestCount: 0,
    };
    const { container } = renderPage(() => undefined, new MemorySquadClient(), () => undefined, new MemoryManagerDeskClient(liveSnapshot));

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Andrew');
    expect(container.textContent).toContain('DJ');
    expect(container.textContent).toContain('Kev');
    expect(container.textContent).toContain('Warren');
    expect(container.textContent).not.toContain('Stan Still Sells Tik');
    expect(container.textContent).not.toContain('Wilde Boars');
    expect(container.textContent).not.toContain('Live scores can still change');
    expect(container.textContent).not.toContain('View live fixture');
    expect(container.querySelectorAll('.manager-desk__fixture-form-row')).toHaveLength(2);
    expect(container.querySelectorAll('.manager-desk__fixture-row-team')).toHaveLength(2);
    expect(container.querySelector('.manager-desk__form-score--w')).not.toBeNull();
    expect(container.querySelector('.manager-desk__form-score--d')).not.toBeNull();
    expect(container.querySelector('.manager-desk__form-score--l')).not.toBeNull();
    expect(container.querySelector('[aria-label*="+2 bonus points"]')).not.toBeNull();
    expect(container.querySelector('.manager-desk__form-score-markers--below i')).not.toBeNull();

    const featuredComparisonLabels = [...container.querySelectorAll<HTMLElement>(
      '.manager-desk__fixture-matchup--featured .manager-desk__fixture-comparison-label',
    )].map((label) => label.textContent);
    expect(featuredComparisonLabels).toEqual(['GW5', '', 'GW1', 'GW2', 'GW3', 'GW4']);
  });

  test('colours prior scores by each team’s own fixture result', async () => {
    const homeTeam = { id: 'team-featured-home', name: 'Home Team', shortName: 'HOM' };
    const awayTeam = { id: 'team-featured-away', name: 'Away Team', shortName: 'AWY' };
    const previousFixtures: LeagueFixture[] = [
      {
        ...scoredFixture(1, 20, 30, 'away_win'),
        id: 'fixture-home-history-1',
        homeTeam,
        awayTeam: { id: 'team-opponent-1', name: 'Opponent One' },
      },
      {
        ...scoredFixture(1, 15, 5, 'home_win'),
        id: 'fixture-away-history-1',
        homeTeam: awayTeam,
        awayTeam: { id: 'team-opponent-2', name: 'Opponent Two' },
      },
    ];
    const nextFixture: LeagueFixture = {
      ...scoredFixture(2, 0, 0, 'pending'),
      id: 'fixture-featured-next',
      gameweek: { id: 'gw-2', name: 'Gameweek 2', number: 2 },
      homeTeam,
      awayTeam,
      status: 'pending',
      isCurrent: false,
      isNext: true,
      score: { homeScore: null, awayScore: null, bonusPoints: {}, chipsPlayed: {}, outcome: 'pending' },
    };
    const snapshot: ManagerDeskSnapshot = {
      context: 'pre_deadline',
      gameweek: nextFixture.gameweek,
      selection: { ...selection, managerTeam: homeTeam, gameweek: nextFixture.gameweek },
      squad: { summary: { ...squad, manager_team: homeTeam }, notifications: { notifications: [], proposed_trade_count: 0 } },
      currentFixture: null,
      nextFixture,
      currentFixtures: [],
      nextFixtures: [nextFixture],
      recentFixtures: previousFixtures,
      formFixtures: previousFixtures,
      leagueTable: { source: 'test', rows: [] },
      availablePlayers: [],
      drawDeadlineAt: null,
      interestCount: 0,
    };
    const { container } = renderPage(() => undefined, new MemorySquadClient(), () => undefined, new MemoryManagerDeskClient(snapshot));

    await act(async () => {
      await Promise.resolve();
    });

    const rows = [...container.querySelectorAll<HTMLElement>('.manager-desk__fixture-matchup--featured .manager-desk__fixture-comparison-row')];
    const gameweekOne = rows.find((row) => row.querySelector('.manager-desk__fixture-comparison-label')?.textContent === 'GW1');
    const scores = gameweekOne?.querySelectorAll('.manager-desk__form-score');
    expect(scores?.[0].classList).toContain('manager-desk__form-score--l');
    expect(scores?.[1].classList).toContain('manager-desk__form-score--w');
  });

  test('keeps account actions behind the compact header profile menu', async () => {
    const destinations: string[] = [];
    let signOutCount = 0;
    const { container } = renderPage(
      (href) => destinations.push(href),
      new MemorySquadClient(),
      () => {
        signOutCount += 1;
      },
    );

    await act(async () => {
      await Promise.resolve();
    });

    const accountMenu = container.querySelector<HTMLDetailsElement>('.manager-account-menu');
    const profileButton = accountMenu?.querySelector<HTMLElement>('summary');
    expect(accountMenu).not.toBeNull();
    expect(profileButton?.textContent).toBe('AM');

    await act(async () => {
      profileButton?.click();
    });

    expect(accountMenu?.open).toBe(true);
    expect(accountMenu?.querySelector('button')?.textContent).toContain('Profile');
    expect(accountMenu?.textContent).toContain('Sign out');
    expect(accountMenu?.textContent).not.toContain('Result colours');

    await act(async () => {
      accountMenu?.querySelector<HTMLButtonElement>('button')?.click();
    });
    expect(destinations).toContain('/profile');

    await act(async () => {
      [...(accountMenu?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
        .find((button) => button.textContent?.includes('Sign out'))
        ?.click();
    });
    expect(signOutCount).toBe(1);
  });

  test('changes the primary action when the fixture lock is active', async () => {
    const lockedSelection = {
      ...selection,
      fixtureLock: { ...selection.fixtureLock, locked: true, reason: 'Deadline passed.' },
    };
    const teamSelectionClient = new MemoryTeamSelectionClient();
    teamSelectionClient.getTeamSelection = async () => lockedSelection;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ThemePresetProvider initialPresetName="teal-light">
          <ManagerDeskPage
          leagueClient={new MemoryLeagueClient()}
          onNavigate={() => undefined}
          onSignOut={() => undefined}
          session={session}
          squadClient={new MemorySquadClient()}
          teamSelectionClient={teamSelectionClient}
          />
        </ThemePresetProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Locked in');
    expect(container.textContent).toContain('View your team');
    expect(container.textContent).not.toContain('Choose a captain');
  });

  test('does not flag players whose FPL status is available', async () => {
    const fitSquad: SquadApiSummary = {
      ...squad,
      players: [{
        ...squad.players[0],
        availability_status: 'a',
        availability_news: '',
        chance_of_playing_next_round: null,
      }],
    };
    const { container } = renderPage(() => undefined, new MemorySquadClient(fitSquad));

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('1 players · 0 flagged');
    expect(container.textContent).not.toContain('Check squad availability');
  });
});
