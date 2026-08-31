import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { LeaguePage } from './LeaguePage';
import { shouldShowFixturePoints, sortFixtureBench } from './components/fixture/FixtureSquadComparison';
import type { FixtureDetailResponse, FixtureSquad, LeagueClient, LeagueSnapshot } from './league-api';
import type { SquadApiHistoryResponse } from './squad-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const castle = { id: 'castle', name: 'Castle United', shortName: 'CAS', managerName: 'Andrew' };
const drafton = { id: 'drafton', name: 'Drafton Rovers', shortName: 'DRA', managerName: 'DJ' };
const keepers = { id: 'keepers', name: 'Keeper City', shortName: 'KPR', managerName: 'Warren' };
const wildcards = { id: 'wildcards', name: 'Wildcard Athletic', shortName: 'WCA', managerName: 'Kevin' };
const pastGameweek = { id: 'gw-11', name: 'Gameweek 11', number: 11, deadlineAt: '2026-08-07T17:30:00Z' };
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

const pastFixture = {
  ...fixture,
  id: 'fixture-1101',
  gameweek: pastGameweek,
  status: 'complete' as const,
  isCurrent: false,
  score: { homeScore: 42, awayScore: 39, bonusPoints: {}, chipsPlayed: {}, outcome: 'home_win' as const },
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

const currentPendingFixture = {
  ...fixture,
  id: 'fixture-1203',
  status: 'pending' as const,
  isCurrent: true,
  detailAvailable: false,
  score: { homeScore: null, awayScore: null, bonusPoints: {}, chipsPlayed: {}, outcome: 'pending' as const },
};

const secondNextFixture = {
  ...nextFixture,
  id: 'fixture-1302',
  homeTeam: keepers,
  awayTeam: wildcards,
};

const semiFinalFixture = {
  ...nextFixture,
  id: 'fixture-sf-01',
  gameweek: { id: 'sf-1', name: 'Semi Final', number: 99 },
  roundLabel: 'Semi Final',
  isNext: false,
};

const snapshot: LeagueSnapshot = {
  currentFixtures: { gameweek, fixtures: [fixture, finishedFixture] },
  nextFixtures: { gameweek: { ...nextFixture.gameweek, deadlineAt: '2026-08-21T17:30:00Z' }, fixtures: [nextFixture] },
  allFixtures: { gameweek: null, fixtures: [pastFixture, fixture, finishedFixture, nextFixture, secondNextFixture, semiFinalFixture] },
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

  async getPlayerHistory(playerId: string): Promise<SquadApiHistoryResponse> {
    return {
      player_id: playerId,
      fetched_at: '2026-08-14T18:00:00Z',
      response_sha256: 'history-sha',
      history: [{
        gameweek: 12,
        fixture_id: 12001,
        opponent_team_id: 101,
        total_points: 8,
        minutes: 90,
        goals_scored: 1,
        assists: 0,
        clean_sheets: 0,
        saves: 0,
        yellow_cards: 0,
        red_cards: 0,
        own_goals: 0,
        bonus: 2,
        bps: 30,
        expected_goals: 0.75,
        expected_assists: 0.1,
        value: 10,
        was_home: true,
        kickoff_time: '2026-08-14T18:00:00Z',
        opponent_name: 'Arsenal',
        opponent_short_name: 'ARS',
        difficulty: 3,
        defensive_contributions: 0,
      }],
      fixtures: [],
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
    const isStartedCurrentFixture = fixtureId === 'fixture-1201';
    const pastKickoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const futureKickoff = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const castleFixture = { fixtureId: `fpl-fixture-${fixtureId}-castle`, gameweek: isStartedCurrentFixture ? gameweek.number : nextFixture.gameweek.number, opponent: drafton, difficulty: 5, isHome: true, kickoffAt: isStartedCurrentFixture ? pastKickoff : futureKickoff };
    const draftonFixture = { fixtureId: `fpl-fixture-${fixtureId}-drafton`, gameweek: isStartedCurrentFixture ? gameweek.number : nextFixture.gameweek.number, opponent: castle, difficulty: 2, isHome: false, kickoffAt: futureKickoff };
    return [
      { team: castle, isUserTeam: true, players: [{ id: 'castle-1', displayName: 'Castle Keeper', position: 'GKP', points: 80, form: 7, nextFixtureDifficulty: 3, fixtureFixtures: [castleFixture], slot: 'starter', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' }, isCaptain: true }, { id: 'castle-2', displayName: 'Castle Bench', position: 'DEF', points: 60, form: 5, slot: 'bench', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' } }, { id: 'castle-3', displayName: 'Castle Reserve', position: 'MID', points: 55, form: 3, slot: 'reserve', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' } }], starters: [{ id: 'castle-1', displayName: 'Castle Keeper', position: 'GKP', points: 80, form: 7, nextFixtureDifficulty: 3, fixtureFixtures: [castleFixture], slot: 'starter', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' }, isCaptain: true }], bench: [{ id: 'castle-2', displayName: 'Castle Bench', position: 'DEF', points: 60, form: 5, slot: 'bench', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' } }], reserves: [{ id: 'castle-3', displayName: 'Castle Reserve', position: 'MID', points: 55, form: 3, slot: 'reserve', club: { id: 'liv', name: 'Liverpool', shortName: 'LIV' } }] },
      { team: drafton, isUserTeam: false, players: [{ id: 'drafton-1', displayName: 'Drafton Keeper', position: 'GKP', points: 70, form: 6, fixtureFixtures: [draftonFixture], slot: 'starter', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }, { id: 'drafton-2', displayName: 'Drafton Defender', position: 'DEF', points: 65, form: 6, slot: 'bench', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }, { id: 'drafton-3', displayName: 'Drafton Reserve', position: 'MID', points: 50, form: 2, slot: 'reserve', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }], starters: [{ id: 'drafton-1', displayName: 'Drafton Keeper', position: 'GKP', points: 70, form: 6, fixtureFixtures: [draftonFixture], slot: 'starter', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }], bench: [{ id: 'drafton-2', displayName: 'Drafton Defender', position: 'DEF', points: 65, form: 6, slot: 'bench', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }], reserves: [{ id: 'drafton-3', displayName: 'Drafton Reserve', position: 'MID', points: 50, form: 2, slot: 'reserve', club: { id: 'ars', name: 'Arsenal', shortName: 'ARS' } }] },
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

class CurrentPendingLeagueClient extends MemoryLeagueClient {
  async getLeagueSnapshot() {
    return {
      ...snapshot,
      currentFixtures: { gameweek, fixtures: [currentPendingFixture] },
      allFixtures: { gameweek: null, fixtures: [pastFixture, currentPendingFixture, nextFixture, secondNextFixture, semiFinalFixture] },
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
  test('uses the Squad-style contextual header with a focused round and gameweek carousel', async () => {
    const { container, root } = await renderPage();

    expect(container.textContent).toContain('Castle Draft League');
    expect(container.textContent).toContain('Fixtures');
    expect(container.textContent).toContain('Table');
    expect(container.textContent).toContain('Gameweek 12');
    expect(container.textContent).toContain('Round 2');
    expect(container.textContent).not.toContain('Gameweeks 8–14');
    expect(container.textContent).not.toContain('7 gameweeks');
    expect(container.textContent).not.toContain('available');
    expect(container.querySelectorAll('.league-round-carousel__slide')).toHaveLength(2);
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"]')?.textContent).toContain('Round 2');
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-round-active-led')).not.toBeNull();
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-fixture-round__header')?.textContent?.trim()).toBe('Round 2');
    const selectedGameweekHeader = container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__slide[aria-current="true"] .league-gameweek-section__header');
    expect(selectedGameweekHeader?.textContent).toContain('Gameweek 12');
    expect(selectedGameweekHeader?.textContent).not.toContain('Current gameweek');
    expect(selectedGameweekHeader?.textContent).not.toContain('Live');
    expect(container.querySelectorAll('.league-round-carousel__slide[aria-current="true"] .league-gameweek-section')).toHaveLength(3);
    expect(container.querySelectorAll('.league-round-carousel__slide[aria-current="true"] .league-fixture-row')).toHaveLength(5);
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__slide[aria-current="true"]')?.textContent).toContain('Gameweek 12');
    expect(container.querySelectorAll('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__slide')).toHaveLength(3);
    expect(container.querySelector('.league-round-carousel__header')).toBeNull();
    expect(container.querySelector('.league-round-carousel__hint')).toBeNull();
    expect(container.querySelector('.league-gameweek-carousel__header')).not.toBeNull();
    expect(container.querySelectorAll('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__dot')).toHaveLength(7);
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__dot.is-selected')?.getAttribute('aria-label')).toBe('Go to Gameweek 12');
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__dot.is-selected')?.getAttribute('data-gameweek-index')).toBe('4');
    expect(container.querySelector('.league-gameweek-carousel')?.getAttribute('style')).toContain('--league-gameweek-carousel-height');
    expect(container.querySelector('.league-gameweek-carousel')?.getAttribute('style')).not.toContain('--league-gameweek-carousel-track-height');
    expect(container.querySelector('.league-gameweek-carousel__viewport')?.getAttribute('style')).toBeNull();
    expect(container.querySelector('.league-round-slide__content')?.getAttribute('style')).toContain('transform: scale(1)');
    expect(container.querySelector('.league-round-carousel__slide:not([aria-current="true"]) .league-round-slide__content')?.getAttribute('style')).toContain('opacity:');
    expect(container.querySelectorAll('.league-round-carousel__dot')).toHaveLength(2);
    expect(container.querySelector('.league-round-carousel__dot.is-selected')?.getAttribute('aria-label')).toBe('Go to Round 2');
    expect(container.querySelectorAll('.league-round-carousel__dot:not(.is-selected)')).toHaveLength(1);
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__slide[aria-current="true"] .league-gameweek-slide__content')?.getAttribute('style')).toContain('transform: scale(1)');
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__slide:not([aria-current="true"]) .league-gameweek-slide__content')?.getAttribute('style')).toContain('opacity:');
    expect(container.querySelectorAll('.league-fixture-row--compact')).toHaveLength(0);
    expect(container.querySelectorAll('.league-round-carousel__slide[aria-current="true"] .league-fixture-row__team')).toHaveLength(10);
    expect(container.querySelector('button[aria-label="Previous round"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Next round"]')).toBeNull();
    expect(container.querySelector('main.league-page.feature-screen')).toBeNull();
    expect(container.querySelector('.league-gameweek-state--underway')).not.toBeNull();
    expect(container.textContent).not.toContain('Current gameweek');
    expect(container.textContent).not.toContain('Upcoming gameweek');
    expect(container.textContent).toContain('Semi Final');
    expect(container.textContent).not.toContain('Pending');
    expect(container.textContent).not.toContain('Upcoming');
    expect(container.textContent).not.toContain('Not started');
    expect(container.textContent).not.toContain('In progress');
    expect(container.textContent).not.toContain('Finished');
    expect(container.querySelector('nav[aria-label="League navigation"]')).toBeNull();
    expect(container.textContent).not.toContain('Overview stays lightweight');
    act(() => root.unmount());
  });

  test('keeps gameweek navigation dots aligned with the selected gameweek', async () => {
    const { container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__dot[aria-label="Go to Gameweek 13"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__dot.is-selected')?.getAttribute('aria-label')).toBe('Go to Gameweek 13');
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__dot.is-selected')?.getAttribute('data-gameweek-index')).toBe('5');
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__slide[aria-current="true"]')?.textContent).toContain('Gameweek 13');
    act(() => root.unmount());
  });

  test('keeps past results in the selected round and makes each prior gameweek available', async () => {
    const { container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Select Gameweek 11"]')?.click();
    });

    expect(container.querySelector('.league-gameweek-section--history')?.textContent).toContain('Gameweek 11');
    expect(container.querySelector<HTMLButtonElement>('button[aria-label*="Open finished fixture for Andrew versus DJ"]')).not.toBeNull();
    act(() => root.unmount());
  });

  test('moves horizontally between rounds while keeping the current round as the default', async () => {
    const { container, root } = await renderPage();

    const nextRound = container.querySelector<HTMLElement>('.league-round-carousel__slide[data-round-index="1"] .league-fixture-round__header h2');
    expect(nextRound).not.toBeNull();

    await act(async () => {
      nextRound?.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"]')?.textContent).toContain('Semi Final');
    expect(container.querySelector('.league-round-carousel__dot.is-selected')?.getAttribute('aria-label')).toBe('Go to Semi Final');
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-fixture-round')?.textContent).toContain('Semi Final');
    expect(container.querySelectorAll('.league-round-carousel__slide[aria-current="true"] .league-gameweek-section')).toHaveLength(1);
    expect(container.querySelectorAll('.league-round-carousel__slide[aria-current="true"] .league-fixture-row')).toHaveLength(1);
    act(() => root.unmount());
  });

  test('uses the round dots to navigate without wrapping', async () => {
    const { container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.league-round-carousel__dot[aria-label="Go to Semi Final"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"]')?.textContent).toContain('Semi Final');
    expect(container.querySelector('.league-round-carousel__dot.is-selected')?.getAttribute('aria-label')).toBe('Go to Semi Final');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.league-round-carousel__dot[aria-label="Go to Round 2"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"]')?.textContent).toContain('Round 2');
    expect(container.querySelector('.league-round-carousel__dot.is-selected')?.getAttribute('aria-label')).toBe('Go to Round 2');
    act(() => root.unmount());
  });

  test('keeps the selected gameweek index when moving between round slides', async () => {
    const { container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Select Gameweek 13"]')?.click();
    });
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__slide[aria-current="true"]')?.textContent).toContain('Gameweek 13');

    await act(async () => {
      container.querySelector<HTMLElement>('.league-round-carousel__slide[data-round-index="1"] .league-fixture-round__header h2')?.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"]')?.textContent).toContain('Semi Final');

    await act(async () => {
      container.querySelector<HTMLElement>('.league-round-carousel__slide[data-round-index="0"] .league-fixture-round__header h2')?.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(container.querySelector('.league-round-carousel__slide[aria-current="true"] .league-gameweek-carousel__slide[aria-current="true"]')?.textContent).toContain('Gameweek 13');
    act(() => root.unmount());
  });

  test('marks a completed gameweek as finalised', async () => {
    const { container, root } = await renderPage('/league', new FinishedLeagueClient());

    const finishedDeadline = container.querySelector('.league-gameweek-state--finished');
    expect(finishedDeadline?.tagName).toBe('TIME');
    expect(finishedDeadline?.getAttribute('aria-label')).toContain('Deadline');
    expect(finishedDeadline?.textContent).not.toContain('Finalised');
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
    expect(client.squadRequests).toEqual(['fixture-1201']);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Gameweek underway');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Live scoring');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Scoring detail is available.');
    expect(container.querySelectorAll('[aria-label="Squad comparison"] [data-fixture-metric="points"]')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-label="Squad comparison"] [data-points-visible="true"]')).toHaveLength(1);
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
    expect(client.squadRequests).toEqual(['fixture-1202']);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Finished fixture');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Final result');
    act(() => root.unmount());
  });

  test('opens an upcoming fixture with both squads on comparison pitches', async () => {
    const { client, container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Select Gameweek 13"]')?.click();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="Open preview for Andrew versus DJ"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(client.squadRequests).toEqual(['fixture-1301']);
    expect(container.querySelector('[aria-label="Squad comparison"]')?.textContent).toContain('Castle Keeper');
    expect(container.querySelectorAll('.fixture-squad-pitch')).toHaveLength(1);
    expect(container.querySelectorAll('.fixture-squad-pitch__lineup-panel')).toHaveLength(2);
    expect(container.querySelector('[aria-label="Andrew starting XI"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="DJ starting XI"]')).not.toBeNull();
    expect(container.querySelectorAll('.fixture-squad-pitch .player-card__shirt-crop img')).toHaveLength(2);
    expect(container.querySelectorAll('.fixture-squad-pitch .fixture-squad-pitch__player.squad-page__pitch-player')).toHaveLength(2);
    expect(container.querySelectorAll('.fixture-squad-pitch .player-card__form-dots')).toHaveLength(2);
    expect(container.querySelectorAll('.fixture-squad-roster .player-card__form-dots')).toHaveLength(4);
    expect(container.querySelectorAll('.fixture-squad-roster .player-card--size-sm')).toHaveLength(4);
    expect(container.querySelector('.fixture-squad-pitch .player-card__role')?.textContent).toBe('C');
    expect(container.querySelector('[data-player-id="castle-1"] .player-card__opponent')?.textContent).toBe('DRA');
    expect(container.querySelector('.fixture-squad-pitch .player-card__opponent--fdr-5')).not.toBeNull();
    expect([...container.querySelectorAll('[aria-label="Andrew substitutes"] .fixture-squad-roster__number')].map((node) => node.textContent)).toEqual(['GK', '1', '2', '3', '4']);
    expect([...container.querySelectorAll('[aria-label="Andrew reserves"] .fixture-squad-roster__number')].map((node) => node.textContent)).toEqual(['1', '2', '3', '4']);
    expect(container.querySelectorAll('.fixture-squad-roster')).toHaveLength(4);
    expect(container.textContent).not.toContain('Predict their XI');
    expect(container.textContent).toContain('Andrew');
    expect(container.textContent).toContain('DJ');
    expect(container.textContent).not.toContain('Castle United');
    expect(container.textContent).not.toContain('Drafton Rovers');
    act(() => root.unmount());
  });

  test('hides point gauges for current-gameweek players before kickoff', async () => {
    const { container, root } = await renderPage('/league', new CurrentPendingLeagueClient());

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="Open preview for Andrew versus DJ"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Squad comparison"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-label="Squad comparison"] .player-card__form-dots')).toHaveLength(0);
    act(() => root.unmount());
  });

  test('puts the goalkeeper first while preserving the four substitute priorities', () => {
    const players = [
      { id: 'mid-1', displayName: 'First outfield substitute', position: 'MID', points: 1, form: 1, slot: 'bench' as const },
      { id: 'gkp', displayName: 'Bench goalkeeper', position: 'GKP', points: 1, form: 1, slot: 'bench' as const },
      { id: 'def-1', displayName: 'Second outfield substitute', position: 'DEF', points: 1, form: 1, slot: 'bench' as const },
      { id: 'fwd-1', displayName: 'Third outfield substitute', position: 'FWD', points: 1, form: 1, slot: 'bench' as const },
      { id: 'def-2', displayName: 'Fourth outfield substitute', position: 'DEF', points: 1, form: 1, slot: 'bench' as const },
    ];

    expect(sortFixtureBench(players).map((player) => player.id)).toEqual(['gkp', 'mid-1', 'def-1', 'fwd-1', 'def-2']);
  });

  test('opens a prior fixture with the locked players and point dots', async () => {
    const { container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Select Gameweek 11"]')?.click();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="Open finished fixture for Andrew versus DJ"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.querySelector('[aria-label="Squad comparison"]')).not.toBeNull();
    expect(dialog?.textContent).toContain('Castle Keeper');
    expect(dialog?.textContent).toContain('Starting XI');
    expect(dialog?.querySelectorAll('[data-fixture-metric="points"]')).toHaveLength(6);
    expect(dialog?.querySelectorAll('.fixture-squad-pitch .player-card__form-dots')).toHaveLength(2);
    expect(dialog?.querySelectorAll('.fixture-squad-roster .player-card__form-dots')).toHaveLength(4);
    act(() => root.unmount());
  });

  test('shows form dots for future fixtures but never points dots', async () => {
    const { container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Select Gameweek 13"]')?.click();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="Open preview for Andrew versus DJ"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelectorAll('[aria-label="Squad comparison"] [data-fixture-metric="form"]')).toHaveLength(6);
    expect(container.querySelectorAll('[aria-label="Squad comparison"] [data-fixture-metric="points"]')).toHaveLength(0);
    act(() => root.unmount());
  });

  test('opens a live fixture player with their points breakdown', async () => {
    const { container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="Open live fixture for Andrew versus DJ"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="View Castle Keeper points breakdown"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const detail = container.querySelector('.player-chart-detail-layer');
    expect(detail?.textContent).toContain('Gameweek 12 · Castle Keeper');
    expect(detail?.textContent).toContain('Fantasy points');
    expect(detail?.textContent).toContain('Minutes');
    expect(detail?.textContent).toContain('Goals');
    expect(detail?.textContent).toContain('+6');
    act(() => root.unmount());
  });

  test('opens an upcoming fixture player in a read-only profile drawer', async () => {
    const { container, root } = await renderPage();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Select Gameweek 13"]')?.click();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label*="Open preview for Andrew versus DJ"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="View Castle Keeper player profile"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const profile = container.querySelector('[data-presentation="drawer"]');
    expect(profile).not.toBeNull();
    expect(profile?.textContent).toContain('Castle Keeper');
    expect(profile?.querySelector('.player-profile__action-bar')).toBeNull();
    expect(profile?.querySelector('[aria-label="Open player actions"]')).toBeNull();
    act(() => root.unmount());
  });

  test('uses kickoff times to decide which current-gameweek players show points', () => {
    const player = { id: 'current-player', displayName: 'Current player', position: 'MID', points: 6, form: 5, slot: 'starter' as const, fixtureFixtures: [{ fixtureId: 'fpl-current', gameweek: gameweek.number, opponent: drafton, isHome: true, kickoffAt: '2026-08-29T10:00:00Z' }] };
    expect(shouldShowFixturePoints('current', player, Date.parse('2026-08-29T11:00:00Z'))).toBe(true);
    expect(shouldShowFixturePoints('current', player, Date.parse('2026-08-29T09:00:00Z'))).toBe(false);
    expect(shouldShowFixturePoints('past', player, Date.parse('2026-08-29T09:00:00Z'))).toBe(true);
    expect(shouldShowFixturePoints('future', player, Date.parse('2026-08-29T11:00:00Z'))).toBe(false);
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
