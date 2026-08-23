import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { LeaguePage } from './LeaguePage';
import type { FixtureDetailResponse, FixtureSquad, LeagueClient, LeagueSnapshot } from './league-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const castle = { id: 'castle', name: 'Castle United', shortName: 'CAS', managerName: 'Andrew' };
const drafton = { id: 'drafton', name: 'Drafton Rovers', shortName: 'DRA', managerName: 'DJ' };
const keepers = { id: 'keepers', name: 'Keeper City', shortName: 'KPR', managerName: 'Warren' };
const wildcards = { id: 'wildcards', name: 'Wildcard Athletic', shortName: 'WCA', managerName: 'Kevin' };
const gameweek = { id: 'gw-12', name: 'Gameweek 12', number: 12, deadlineAt: '2026-08-14T17:30:00Z' };
const fixture = {
  id: 'fixture-1201',
  gameweek,
  homeTeam: castle,
  awayTeam: drafton,
  status: 'started' as const,
  kickoffLabel: 'GW12 live',
  roundLabel: 'Regular season',
  isCurrent: true,
  isNext: false,
  detailAvailable: true,
  score: {
    homeScore: 58,
    awayScore: 52,
    bonusPoints: { castle: 3 },
    chipsPlayed: { castle: ['Triple Captain'] },
    outcome: 'home_win' as const,
  },
};

const finishedFixture = {
  ...fixture,
  id: 'fixture-1202',
  homeTeam: drafton,
  awayTeam: castle,
  status: 'complete' as const,
  score: { homeScore: 48, awayScore: 43, bonusPoints: {}, chipsPlayed: {}, outcome: 'home_win' as const },
};

const nextFixture = {
  ...fixture,
  id: 'fixture-1301',
  gameweek: { id: 'gw-13', name: 'Gameweek 13', number: 13 },
  status: 'pending' as const,
  isCurrent: false,
  isNext: true,
  detailAvailable: false,
  score: { homeScore: null, awayScore: null, bonusPoints: {}, chipsPlayed: {}, outcome: 'pending' as const },
};

const secondNextFixture = {
  ...nextFixture,
  id: 'fixture-1302',
  homeTeam: keepers,
  awayTeam: wildcards,
};

const snapshot: LeagueSnapshot = {
  currentFixtures: { gameweek, fixtures: [fixture, finishedFixture] },
  nextFixtures: { gameweek: { ...nextFixture.gameweek, deadlineAt: '2026-08-21T17:30:00Z' }, fixtures: [nextFixture] },
  allFixtures: { gameweek: null, fixtures: [fixture, finishedFixture, nextFixture, secondNextFixture] },
  table: {
    source: 'service-calculated',
    rows: [{ position: 1, team: castle, played: 1, wins: 1, draws: 0, losses: 0, pointsFor: 58, pointsAgainst: 52, pointsDifference: 6, leaguePoints: 3 }],
  },
  knockout: { rounds: ['Semi Final'], matches: [] },
  headToHead: { records: [] },
};

class MemoryNotificationsClient {
  async getNotifications() {
    return {
      notifications: [{ id: 'notice-1', title: 'Fixture update', message: 'Gameweek 12 is underway.', action_href: '/league', kind: 'fixture' }],
      proposed_trade_count: 0,
    };
  }
}

class MemoryLeagueClient implements LeagueClient {
  detailRequests: string[] = [];
  squadRequests: string[] = [];

  async getLeagueSnapshot() {
    return snapshot;
  }

  async getFixtureDetail(fixtureId: string): Promise<FixtureDetailResponse> {
    this.detailRequests.push(fixtureId);
    return {
      fixture,
      events: [{ label: 'Bonus points awarded', team: castle, points: 3, ruleReference: 'league-table' }],
      notes: ['Scoring detail is available.'],
    };
  }

  async getFixtureSquads(fixtureId: string): Promise<FixtureSquad[]> {
    this.squadRequests.push(fixtureId);
    return [
      { team: castle, isUserTeam: true, players: [{ id: 'castle-1', displayName: 'Castle Keeper', position: 'GKP', points: 80, form: 7, nextFixtureDifficulty: 3, slot: 'starter', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' }, isCaptain: true }, { id: 'castle-2', displayName: 'Castle Bench', position: 'DEF', points: 60, form: 5, slot: 'bench', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' } }, { id: 'castle-3', displayName: 'Castle Reserve', position: 'MID', points: 55, form: 3, slot: 'reserve', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' } }], starters: [{ id: 'castle-1', displayName: 'Castle Keeper', position: 'GKP', points: 80, form: 7, nextFixtureDifficulty: 3, slot: 'starter', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' }, isCaptain: true }], bench: [{ id: 'castle-2', displayName: 'Castle Bench', position: 'DEF', points: 60, form: 5, slot: 'bench', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' } }], reserves: [{ id: 'castle-3', displayName: 'Castle Reserve', position: 'MID', points: 55, form: 3, slot: 'reserve', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' } }] },
      { team: drafton, isUserTeam: false, players: [{ id: 'drafton-1', displayName: 'Drafton Keeper', position: 'GKP', points: 70, form: 6, slot: 'starter', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }, { id: 'drafton-2', displayName: 'Drafton Defender', position: 'DEF', points: 65, form: 6, slot: 'bench', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }, { id: 'drafton-3', displayName: 'Drafton Reserve', position: 'MID', points: 50, form: 2, slot: 'reserve', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }], starters: [{ id: 'drafton-1', displayName: 'Drafton Keeper', position: 'GKP', points: 70, form: 6, slot: 'starter', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }], bench: [{ id: 'drafton-2', displayName: 'Drafton Defender', position: 'DEF', points: 65, form: 6, slot: 'bench', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }], reserves: [{ id: 'drafton-3', displayName: 'Drafton Reserve', position: 'MID', points: 50, form: 2, slot: 'reserve', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }] },
    ];
  }
}

class FinishedLeagueClient extends MemoryLeagueClient {
  async getLeagueSnapshot() {
    return {
      ...snapshot,
      currentFixtures: { gameweek, fixtures: [finishedFixture] },
      nextFixtures: { gameweek: null, fixtures: [] },
      allFixtures: { gameweek: null, fixtures: [finishedFixture] },
    };
  }
}

async function renderPage(currentPath = '/league', client = new MemoryLeagueClient(), attackDirection: 'up' | 'down' = 'up') {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<LeaguePage attackDirection={attackDirection} currentPath={currentPath} leagueClient={client} onNavigate={() => undefined} squadClient={new MemoryNotificationsClient()} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { client, container, root };
}

describe('LeaguePage', () => {
  test('uses the Squad-style contextual header and compact gameweek sections', async () => {
    const { container, root } = await renderPage();

    expect(container.textContent).toContain('Castle Draft League');
    expect(container.textContent).toContain('Fixtures');
    expect(container.textContent).toContain('Table');
    expect(container.textContent).toContain('Gameweek 12');
    expect(container.textContent).toContain('Gameweek 13');
    expect(container.querySelectorAll('.league-gameweek-section')).toHaveLength(2);
    expect(container.querySelectorAll('.league-fixture-row')).toHaveLength(4);
    expect(container.querySelector('main.league-page.feature-screen')).toBeNull();
    expect(container.querySelectorAll('time.league-gameweek-state')).toHaveLength(1);
    expect(container.querySelector('time.league-gameweek-state')?.getAttribute('dateTime')).toBe('2026-08-21T17:30:00Z');
    expect(container.querySelector('.league-gameweek-state--underway')).not.toBeNull();
    expect(container.querySelector('.league-gameweek-state--not-started')).not.toBeNull();
    expect(container.textContent).not.toContain('Current gameweek');
    expect(container.textContent).not.toContain('Upcoming gameweek');
    expect(container.textContent).not.toContain('Regular season');
    expect(container.textContent).not.toContain('Pending');
    expect(container.textContent).not.toContain('Upcoming');
    expect(container.textContent).not.toContain('Not started');
    expect(container.textContent).not.toContain('In progress');
    expect(container.textContent).not.toContain('Finished');
    expect(container.textContent).toContain('Warren');
    expect(container.textContent).toContain('Kevin');
    expect(container.querySelector('nav[aria-label="League navigation"]')).toBeNull();
    expect(container.textContent).not.toContain('Overview stays lightweight');
    act(() => root.unmount());
  });

  test('marks a completed gameweek as finalised', async () => {
    const { container, root } = await renderPage('/league', new FinishedLeagueClient());

    expect(container.querySelector('.league-gameweek-state--finished')?.textContent).toContain('Finalised');
    expect(container.textContent).not.toContain('Finished');
    act(() => root.unmount());
  });

  test('opens a started fixture as live scoring detail', async () => {
    const { client, container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="Open live fixture for Andrew versus DJ"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(client.detailRequests).toEqual(['fixture-1201']);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Gameweek underway');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Live scoring');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Scoring detail is available.');
    act(() => root.unmount());
  });

  test('opens a finished fixture with final-result content', async () => {
    const { client, container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="Open finished fixture for DJ versus Andrew"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(client.detailRequests).toEqual(['fixture-1202']);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Finished fixture');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Final result');
    act(() => root.unmount());
  });

  test('opens an upcoming fixture with both squads on comparison pitches', async () => {
    const { client, container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="Open preview for Andrew versus DJ"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(client.squadRequests).toEqual(['fixture-1301']);
    expect(container.querySelector('[aria-label="Squad comparison"]')?.textContent).toContain('Castle Keeper');
    expect(container.querySelectorAll('.fixture-squad-pitch')).toHaveLength(1);
    expect(container.querySelectorAll('.fixture-squad-pitch .player-card__shirt-crop img')).toHaveLength(2);
    expect(container.querySelectorAll('.fixture-squad-pitch .player-card__form-dots')).toHaveLength(2);
    expect(container.querySelectorAll('.fixture-squad-roster .player-card__form-dots')).toHaveLength(4);
    expect(container.querySelector('.fixture-squad-pitch .player-card__role')?.textContent).toBe('C');
    expect(container.querySelector('.fixture-squad-pitch .player-card__opponent--fdr-3')).not.toBeNull();
    expect(container.querySelectorAll('.fixture-squad-roster')).toHaveLength(4);
    expect(container.textContent).toContain('Andrew');
    expect(container.textContent).toContain('DJ');
    expect(container.textContent).not.toContain('Castle United');
    expect(container.textContent).not.toContain('Drafton Rovers');
    act(() => root.unmount());
  });

  test('switches between fixtures and table without exposing a second league navigation', async () => {
    const { container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="View table"]')?.click();
    });

    expect(container.textContent).toContain('League table');
    expect(container.textContent).not.toContain('Current fixtures');
    expect(container.querySelector('button[aria-label="View table"]')?.getAttribute('aria-pressed')).toBe('true');
    act(() => root.unmount());
  });

  test('opens the notifications popover from the League header', async () => {
    const { container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="Notifications"]')?.click();
    });

    expect(container.querySelector('[aria-label="Notifications"][role="dialog"]')?.textContent).toContain('Fixture update');
    expect(container.querySelector('.league-page__notification-count')?.textContent).toBe('1');
    act(() => root.unmount());
  });
});
