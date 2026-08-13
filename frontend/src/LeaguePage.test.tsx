import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { LeaguePage } from './LeaguePage';
import type { FixtureDetailResponse, FixtureSquad, LeagueClient, LeagueSnapshot } from './league-api';

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
      { team: castle, isUserTeam: true, players: [{ id: 'castle-1', displayName: 'Castle Keeper', position: 'GKP', points: 80, form: 7, nextFixtureDifficulty: 3, slot: 'starter', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' }, isCaptain: true }], starters: [{ id: 'castle-1', displayName: 'Castle Keeper', position: 'GKP', points: 80, form: 7, nextFixtureDifficulty: 3, slot: 'starter', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' }, isCaptain: true }], bench: [], reserves: [] },
      { team: drafton, isUserTeam: false, players: [{ id: 'drafton-1', displayName: 'Drafton Keeper', position: 'GKP', points: 70, form: 6, slot: 'starter', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }, { id: 'drafton-2', displayName: 'Drafton Defender', position: 'DEF', points: 65, form: 6, slot: 'bench', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }], starters: [{ id: 'drafton-1', displayName: 'Drafton Keeper', position: 'GKP', points: 70, form: 6, slot: 'starter', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }], bench: [{ id: 'drafton-2', displayName: 'Drafton Defender', position: 'DEF', points: 65, form: 6, slot: 'bench', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }], reserves: [] },
    ];
  }
}

async function renderPage(currentPath = '/league', client = new MemoryLeagueClient(), attackDirection: 'up' | 'down' = 'up') {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<LeaguePage attackDirection={attackDirection} currentPath={currentPath} leagueClient={client} onNavigate={() => undefined} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { client, container, root };
}

describe('LeaguePage', () => {
  test('keeps the overview focused on status and the next action', async () => {
    const { container, root } = await renderPage();

    expect(container.textContent).toContain('The current round is in play');
    expect(container.textContent).toContain('Overview stays lightweight');
    expect(container.textContent).not.toContain('Fixtures in play');
    expect(container.textContent).not.toContain('Who is setting the pace');
    expect(container.textContent).not.toContain('Knockout path');
    expect(container.textContent).not.toContain('Head-to-head records');
    expect(container.querySelector('.league-fixture-card')).toBeNull();
    act(() => root.unmount());
  });

  test('opens started fixture detail from the selected fixtures view', async () => {
    const { client, container, root } = await renderPage('/league/fixtures');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="Castle United versus Drafton Rovers"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(client.detailRequests).toEqual(['fixture-1201']);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Scoring detail is available.');
    act(() => root.unmount());
  });

  test('opens an upcoming fixture with both squads on comparison pitches', async () => {
    const { client, container, root } = await renderPage('/league/fixtures');

    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>('button[aria-label*="Compare squads for Castle United versus Drafton Rovers"]')[1]?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(client.squadRequests).toEqual(['fixture-1301']);
    expect(container.querySelector('[aria-label="Squad comparison"]')?.textContent).toContain('Castle Keeper');
    expect(container.querySelectorAll('.fixture-squad-pitch')).toHaveLength(1);
    expect(container.querySelectorAll('.fixture-squad-pitch .squad-page__pitch-shirt-crop img')).toHaveLength(2);
    expect(container.querySelectorAll('.fixture-squad-pitch .squad-page__form-dots')).toHaveLength(2);
    expect(container.querySelector('.fixture-squad-pitch .squad-page__captain')?.textContent).toBe('C');
    expect(container.querySelector('.fixture-squad-pitch .squad-page__opponent--fdr-3')).not.toBeNull();
    expect(container.querySelectorAll('.fixture-squad-roster')).toHaveLength(4);
    expect(container.querySelectorAll('.fixture-squad-roster[aria-label*="substitutes"] ol li')).toHaveLength(10);
    expect(container.querySelectorAll('.fixture-squad-roster[aria-label*="reserves"] ol li')).toHaveLength(8);
    expect(container.querySelector('[aria-label="Squad comparison"]')?.textContent).toContain('Substitutes');
    act(() => root.unmount());
  });

  test('puts my team at the top when I attack down and keeps the opponent prediction editable', async () => {
    const { container, root } = await renderPage('/league/fixtures', new MemoryLeagueClient(), 'down');

    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>('button[aria-label*="Compare squads for Castle United versus Drafton Rovers"]')[1]?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const pitch = container.querySelector<HTMLElement>('.fixture-squad-pitch');
    expect(pitch?.dataset.topTeamRole).toBe('user');
    expect(pitch?.dataset.bottomTeamRole).toBe('opponent');
    expect(pitch?.dataset.topAttackDirection).toBe('down');
    expect(pitch?.dataset.bottomAttackDirection).toBe('up');
    expect(container.querySelector('[aria-label="Drafton Rovers lineup prediction"]')).not.toBeNull();
    expect(container.querySelector('button[aria-pressed="false"]')).not.toBeNull();
    act(() => root.unmount());
  });

  test('renders only the content for the selected competition tab', async () => {
    const views = [
      { path: '/league/fixtures', visible: 'Current fixtures', hidden: ['League table', 'Knockout bracket', 'Head-to-head records'] },
      { path: '/league/table', visible: 'League table', hidden: ['Current fixtures', 'Knockout bracket', 'Head-to-head records'] },
      { path: '/league/knockout', visible: 'Knockout bracket', hidden: ['Current fixtures', 'League table', 'Head-to-head records'] },
      { path: '/league/head-to-head', visible: 'Head-to-head records', hidden: ['Current fixtures', 'League table', 'Knockout bracket'] },
    ] as const;

    for (const view of views) {
      const { container, root } = await renderPage(view.path);
      expect(container.textContent).toContain(view.visible);
      for (const hiddenSection of view.hidden) {
        expect(container.textContent).not.toContain(hiddenSection);
      }
      act(() => root.unmount());
    }
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
