import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test } from 'vitest';

import { FixtureSquadComparison, fixturePointsPlaceholder } from './FixtureSquadComparison';
import type { FixtureSquad, FixtureSquadPlayer } from '../../league-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const alphaTeam = { id: 'alpha', name: 'Alpha', shortName: 'ALP' };
const betaTeam = { id: 'beta', name: 'Beta', shortName: 'BET' };
const arsenal = { id: 'ars', name: 'Arsenal', shortName: 'ARS' };
const chelsea = { id: 'che', name: 'Chelsea', shortName: 'CHE' };
const now = Date.parse('2026-09-06T00:15:00Z');

function player(
  id: string,
  points: number,
  state: Pick<FixtureSquadPlayer, 'minutes' | 'hasStartedFixture' | 'allFixturesFinished'>,
  kickoffAt: string,
): FixtureSquadPlayer {
  return {
    id,
    displayName: id,
    position: 'MID',
    club: arsenal,
    fixtureFixtures: [{
      fixtureId: `fixture-${id}`,
      gameweek: 3,
      opponent: chelsea,
      difficulty: 3,
      isHome: true,
      kickoffAt,
    }],
    points,
    form: 4,
    slot: 'starter',
    ...state,
  };
}

function squads(alphaPlayer: FixtureSquadPlayer, betaPlayer?: FixtureSquadPlayer): FixtureSquad[] {
  const opponent = betaPlayer ?? player(
    'beta-player',
    2,
    { minutes: 45, hasStartedFixture: true, allFixturesFinished: false },
    '2026-09-05T22:00:00Z',
  );
  return [
    {
      team: alphaTeam,
      isUserTeam: true,
      players: [alphaPlayer],
      starters: [alphaPlayer],
      bench: [],
      reserves: [],
    },
    {
      team: betaTeam,
      isUserTeam: false,
      players: [opponent],
      starters: [opponent],
      bench: [],
      reserves: [],
    },
  ];
}

async function renderCurrent(alphaPlayer: FixtureSquadPlayer) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <FixtureSquadComparison
        attackDirection="up"
        gameweekStatus="current"
        now={now}
        squads={squads(alphaPlayer)}
      />,
    );
  });
  return { container, root };
}

beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '';
});

describe('live fixture point presentation', () => {
  test('uses a cropped shirt and ellipsis before the player fixture starts', async () => {
    const pending = player(
      'pending-player',
      0,
      { minutes: 0, hasStartedFixture: false, allFixturesFinished: false },
      '2026-09-06T10:00:00Z',
    );

    const { container, root } = await renderCurrent(pending);
    const card = container.querySelector('[data-player-id="pending-player"] .player-card');

    expect(card?.classList.contains('player-card--shirt-cropped')).toBe(true);
    expect(card?.querySelector('.player-card__points-placeholder')?.textContent).toBe('…');
    expect(card?.querySelector('.player-card__points')).toBeNull();
    expect(fixturePointsPlaceholder('current', pending, now)).toBe('…');

    await act(async () => root.unmount());
  });

  test('shows a dash after a finished fixture when the player played zero minutes', async () => {
    const noShow = player(
      'no-show',
      0,
      { minutes: 0, hasStartedFixture: true, allFixturesFinished: true },
      '2026-09-05T22:00:00Z',
    );

    const { container, root } = await renderCurrent(noShow);
    expect(container.querySelector('[data-player-id="no-show"] .player-card__points-placeholder')?.textContent).toBe('-');

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="View as list"]')?.click());
    expect(container.querySelector('[data-player-id="no-show"] [data-fixture-list-metric="points"] strong')?.textContent).toBe('-');

    await act(async () => root.unmount());
  });

  test('shows live gameweek points once the player fixture has started', async () => {
    const live = player(
      'live-player',
      7,
      { minutes: 61, hasStartedFixture: true, allFixturesFinished: false },
      '2026-09-05T22:00:00Z',
    );

    const { container, root } = await renderCurrent(live);
    expect(container.querySelector('[data-player-id="live-player"] .player-card__points')?.textContent).toBe('7');

    await act(async () => root.unmount());
  });
});
