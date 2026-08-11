import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import type { SessionState } from './contracts';
import { ManagerDeskPage } from './ManagerDeskPage';
import type { LeagueClient, LeagueSnapshot } from './league-api';
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

  async getSummary() { return this.summary; }
  async getScoutingPlayers() { return { players: this.summary.players }; }
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
    };
  }
  async getPlayerHistory(): Promise<SquadApiHistoryResponse> {
    return { player_id: 'p1', fetched_at: '2030-01-01', response_sha256: 'test', history: [], fixtures: [] };
  }
  async createTrade() { return { id: 'trade-1', status: 'proposed' }; }
  async applyChanges() { return this.summary; }
}

function renderPage(
  onNavigate: (href: string) => void = () => undefined,
  squadClient: SquadClient = new MemorySquadClient(),
  onSignOut: () => void = () => undefined,
) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ThemePresetProvider initialPresetName="teal-light">
        <ManagerDeskPage
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

    expect(container.querySelector('h1')?.textContent).toBe('Gaffers Desk');
    expect(container.textContent).not.toContain('Manager workspace');
    expect(container.textContent).not.toContain('Good to see you, Alex');
    expect(container.querySelector('.manager-desk__header > h1')?.textContent).toBe('Gaffers Desk');
    expect(container.querySelector('.manager-desk__header > .manager-account-menu')).not.toBeNull();
    expect(container.textContent).toContain('Review your starting XI');
    expect(container.textContent).toContain('Check squad availability');
    expect(container.textContent).toContain('Review fixture difficulty');
    expect(container.textContent).toContain('River Rangers');
    expect(container.textContent).not.toContain('Quick actions');
    expect(container.textContent).not.toContain('Shortcuts');
    expect(container.textContent).not.toContain('Refresh data');
    expect(container.querySelector('[aria-label="Account settings"]')).toBeNull();
    expect(container.querySelector('[aria-label="Account menu for Alex Manager"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Account menu"]')?.textContent).toContain('Account');

    const teamButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Set your team'));
    await act(async () => {
      teamButton?.click();
    });
    expect(destinations).toContain('/team-selection');
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
    expect(accountMenu?.querySelector('button')?.textContent).toContain('Account');
    expect(accountMenu?.textContent).toContain('Sign out');

    await act(async () => {
      accountMenu?.querySelector<HTMLButtonElement>('button')?.click();
    });
    expect(destinations).toContain('/account');

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

    expect(container.textContent).toContain('Your team is locked in.');
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
