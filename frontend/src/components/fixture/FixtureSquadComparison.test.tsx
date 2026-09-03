import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test } from 'vitest';

import { FixtureSquadComparison, sortFixtureListPlayers } from './FixtureSquadComparison';
import type { FixtureSquad, FixtureSquadPlayer } from '../../league-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const alphaTeam = { id: 'alpha', name: 'Alpha FC', shortName: 'ALP', managerName: 'Andrew' };
const betaTeam = { id: 'beta', name: 'Beta FC', shortName: 'BET', managerName: 'DJ' };
const arsenal = { id: 'ars', name: 'Arsenal', shortName: 'ARS' };
const chelsea = { id: 'che', name: 'Chelsea', shortName: 'CHE' };

function player(
  id: string,
  displayName: string,
  position: string,
  slot: 'starter' | 'bench' | 'reserve',
  points: number,
  kickoffAt = '2026-08-30T10:00:00Z',
): FixtureSquadPlayer {
  return {
    id,
    displayName,
    position,
    points,
    form: 6,
    slot,
    club: arsenal,
    fixtureFixtures: [{
      fixtureId: `fixture-${id}`,
      gameweek: 1,
      opponent: chelsea,
      difficulty: 3,
      isHome: true,
      kickoffAt,
    }],
  };
}

function squads(): FixtureSquad[] {
  const alphaPlayers = [
    player('alpha-mid', 'Alpha Midfielder', 'MID', 'starter', 6),
    player('alpha-gk', 'Alpha Keeper', 'GKP', 'starter', 8),
    player('alpha-def', 'Alpha Defender', 'DEF', 'bench', 4),
    player('alpha-reserve', 'Alpha Reserve', 'FWD', 'reserve', 2),
  ];
  const betaPlayers = [
    player('beta-fwd', 'Beta Forward', 'FWD', 'starter', 9),
    player('beta-gk', 'Beta Keeper', 'GKP', 'starter', 5),
    player('beta-bench', 'Beta Bench', 'MID', 'bench', 3),
    player('beta-reserve', 'Beta Reserve', 'DEF', 'reserve', 1),
  ];
  return [
    {
      team: alphaTeam,
      isUserTeam: true,
      players: alphaPlayers,
      starters: alphaPlayers.filter((entry) => entry.slot === 'starter'),
      bench: alphaPlayers.filter((entry) => entry.slot === 'bench'),
      reserves: alphaPlayers.filter((entry) => entry.slot === 'reserve'),
    },
    {
      team: betaTeam,
      isUserTeam: false,
      players: betaPlayers,
      starters: betaPlayers.filter((entry) => entry.slot === 'starter'),
      bench: betaPlayers.filter((entry) => entry.slot === 'bench'),
      reserves: betaPlayers.filter((entry) => entry.slot === 'reserve'),
    },
  ];
}

async function renderComparison(
  gameweekStatus: 'past' | 'current' | 'future' = 'past',
  onPlayerClick?: (player: FixtureSquadPlayer) => void,
  fixtureSquads: FixtureSquad[] = squads(),
) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <FixtureSquadComparison
        attackDirection="up"
        gameweekStatus={gameweekStatus}
        now={Date.parse('2026-08-31T10:00:00Z')}
        onPlayerClick={onPlayerClick}
        playerInteraction={gameweekStatus === 'future' ? 'profile' : 'points'}
        squads={fixtureSquads}
      />,
    );
  });
  return { container, root };
}

beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '';
});

describe('FixtureSquadComparison', () => {
  test('starts in pitch view and uses the Squad-style pitch/list toggle', async () => {
    const { container, root } = await renderComparison();

    const pitchButton = container.querySelector<HTMLButtonElement>('button[aria-label="View as pitch"]');
    const listButton = container.querySelector<HTMLButtonElement>('button[aria-label="View as list"]');

    expect(pitchButton?.getAttribute('aria-pressed')).toBe('true');
    expect(listButton?.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('.fixture-squad-pitch__field')).not.toBeNull();
    expect(container.querySelector('.fixture-squad-list')).toBeNull();

    await act(async () => root.unmount());
  });

  test('switches to a two-team list with starters, substitutes, reserves, and points', async () => {
    const { container, root } = await renderComparison();

    const listButton = container.querySelector<HTMLButtonElement>('button[aria-label="View as list"]');
    await act(async () => listButton?.click());

    expect(listButton?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.fixture-squad-pitch__field')).toBeNull();
    expect(container.querySelectorAll('.fixture-squad-list__team')).toHaveLength(2);
    expect(container.textContent).toContain('Starting XI');
    expect(container.textContent).toContain('Substitutes');
    expect(container.textContent).toContain('Reserves');
    expect(container.textContent).toContain('Alpha Keeper');
    expect(container.textContent).toContain('Beta Forward');
    expect(container.querySelector('[data-player-id="alpha-gk"] [data-fixture-list-metric="points"]')?.textContent).toContain('8');
    expect(window.localStorage.getItem('cdl:fixture-review-view')).toBe('list');

    await act(async () => root.unmount());
  });

  test('keeps substitution players in their original slots while dimming only the replaced player', async () => {
    const fixtureSquads = squads();
    fixtureSquads[0].starters.find((entry) => entry.id === 'alpha-gk')!.isSubstitutedOut = true;
    fixtureSquads[0].bench[0].isSubstitutedIn = true;

    const { container, root } = await renderComparison('past', undefined, fixtureSquads);
    expect(container.querySelector('[data-player-id="alpha-gk"] .fixture-squad-player-card--substituted-out')).not.toBeNull();
    expect(container.querySelector('[data-player-id="alpha-def"] .fixture-squad-player-card--substituted-in')).not.toBeNull();

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="View as list"]')?.click());

    const replacedRow = container.querySelector('[data-player-id="alpha-gk"]');
    const substituteRow = container.querySelector('[data-player-id="alpha-def"]');

    expect(replacedRow?.classList.contains('fixture-squad-list__player--substituted-out')).toBe(true);
    expect(substituteRow?.classList.contains('fixture-squad-list__player--substituted-out')).toBe(false);
    expect(replacedRow?.textContent).toContain('Alpha Keeper');
    expect(replacedRow?.textContent).toContain('8');
    expect(substituteRow?.textContent).toContain('Alpha Defender');
    expect(substituteRow?.textContent).toContain('4');
    expect(container.querySelector('.fixture-squad-list__substitution--in')?.textContent).toBe('IN');
    expect(container.querySelector('.fixture-squad-list__substitution--out')?.textContent).toBe('OUT');

    await act(async () => root.unmount());
  });

  test('keeps future fixtures in form mode and routes list player taps to the supplied interaction', async () => {
    let selectedId: string | null = null;
    const { container, root } = await renderComparison('future', (selected) => {
      selectedId = selected.id;
    });

    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="View as list"]')?.click());

    const playerButton = container.querySelector<HTMLButtonElement>('button[aria-label="View Alpha Keeper player profile"]');
    expect(container.querySelector('[data-player-id="alpha-gk"] [data-fixture-list-metric="form"]')).not.toBeNull();

    await act(async () => playerButton?.click());
    expect(selectedId).toBe('alpha-gk');

    await act(async () => root.unmount());
  });

  test('sorts starter list rows by goalkeeper, defender, midfielder, then forward without disturbing position order', () => {
    const unordered = [
      player('fwd-1', 'Forward One', 'FWD', 'starter', 1),
      player('mid-1', 'Mid One', 'MID', 'starter', 1),
      player('gk-1', 'Keeper One', 'GKP', 'starter', 1),
      player('mid-2', 'Mid Two', 'MID', 'starter', 1),
      player('def-1', 'Defender One', 'DEF', 'starter', 1),
    ];

    expect(sortFixtureListPlayers(unordered).map((entry) => entry.id)).toEqual([
      'gk-1',
      'def-1',
      'mid-1',
      'mid-2',
      'fwd-1',
    ]);
  });
});
