import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { LeaguePage } from './LeaguePage';
import type { FixtureDetailResponse, LeagueClient, LeagueSnapshot } from './league-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const castle = { id: 'castle', name: 'Castle United', shortName: 'CAS' };
const drafton = { id: 'drafton', name: 'Drafton Rovers', shortName: 'DRA' };
const gameweek = { id: 'gw-12', name: 'Gameweek 12', number: 12 };
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

const snapshot: LeagueSnapshot = {
  currentFixtures: { gameweek, fixtures: [fixture] },
  nextFixtures: { gameweek: nextFixture.gameweek, fixtures: [nextFixture] },
  allFixtures: { gameweek: null, fixtures: [fixture, nextFixture] },
  table: {
    source: 'service-calculated',
    rows: [{ position: 1, team: castle, played: 1, wins: 1, draws: 0, losses: 0, pointsFor: 58, pointsAgainst: 52, pointsDifference: 6, leaguePoints: 3 }],
  },
  knockout: { rounds: ['Semi Final'], matches: [] },
  headToHead: { records: [] },
};

class MemoryLeagueClient implements LeagueClient {
  detailRequests: string[] = [];

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
}

async function renderPage(currentPath = '/league', client = new MemoryLeagueClient()) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<LeaguePage currentPath={currentPath} leagueClient={client} onNavigate={() => undefined} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { client, container, root };
}

describe('LeaguePage', () => {
  test('keeps the overview focused and opens started fixture detail', async () => {
    const { client, container, root } = await renderPage();

    expect(container.textContent).toContain('The current round is in play');
    expect(container.textContent).toContain('Who is setting the pace');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="View details"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(client.detailRequests).toEqual(['fixture-1201']);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Scoring detail is available.');
    act(() => root.unmount());
  });

  test('filters the all-fixtures list without changing the API snapshot', async () => {
    const { container, root } = await renderPage('/league/fixtures');
    const select = container.querySelector('select') as HTMLSelectElement;

    await act(async () => {
      select.value = 'pending';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Gameweek 13');
    expect(container.querySelector('.league-fixture-list')?.textContent).not.toContain('GW12 live');
    act(() => root.unmount());
  });

  test('labels a calculated standings snapshot instead of implying historical provenance', async () => {
    const { container, root } = await renderPage('/league/table');

    expect(container.textContent).toContain('Calculated snapshot');
    expect(container.textContent).toContain('Position movement will appear once the snapshot includes a previous-table comparison.');
    act(() => root.unmount());
  });
});
