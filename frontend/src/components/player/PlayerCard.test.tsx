import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import { FormDots, PlayerCard } from './PlayerCard';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ container: HTMLDivElement; root: ReturnType<typeof createRoot> }> = [];

afterEach(() => {
  mountedRoots.forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
  mountedRoots.length = 0;
});

describe('PlayerCard', () => {
  test('renders the latest five gameweeks with score bands, grey non-appearances, and split double gameweeks', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ container, root });

    act(() => {
      root.render(
        <FormDots
          history={[
            { gameweek: 1, fixtures: [{ fixtureId: 1, minutes: 90, points: 0 }] },
            { gameweek: 2, fixtures: [{ fixtureId: 2, minutes: 90, points: 2 }] },
            { gameweek: 3, fixtures: [{ fixtureId: 3, minutes: 90, points: 4 }] },
            { gameweek: 4, fixtures: [{ fixtureId: 4, minutes: 90, points: 6 }] },
            { gameweek: 5, fixtures: [{ fixtureId: 5, minutes: 0, points: 8 }, { fixtureId: 6, minutes: 90, points: 8 }] },
          ]}
        />,
      );
    });

    const dots = [...container.querySelectorAll('.player-card__form-dot')];
    expect(dots).toHaveLength(5);
    expect(dots.map((dot) => dot.className)).toEqual([
      'player-card__form-dot player-card__form-dot--colour-1',
      'player-card__form-dot player-card__form-dot--colour-2',
      'player-card__form-dot player-card__form-dot--colour-3',
      'player-card__form-dot player-card__form-dot--colour-4',
      'player-card__form-dot player-card__form-dot--split',
    ]);
    expect(dots[4]?.getAttribute('data-fixture-count')).toBe('2');
    expect(dots[4]?.getAttribute('data-gameweek')).toBe('5');
    expect(dots[4]?.getAttribute('style')).toContain('--form-first-colour: var(--player-form-empty)');
    expect(dots[4]?.getAttribute('style')).toContain('--form-second-colour: var(--player-form-colour-5)');
  });

  test('keeps all five slots grey when history is unavailable', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ container, root });

    act(() => {
      root.render(<FormDots />);
    });

    expect(container.querySelectorAll('.player-card__form-dot--empty')).toHaveLength(5);
  });

  test('shares the same player token while moving form beside or below it', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ container, root });

    act(() => {
      root.render(
        <>
          <PlayerCard
            formPosition="below"
            layout="pitch"
            player={{
              availabilityChance: 75,
              captain: true,
              displayName: "Viktor Gyökeres",
              fixtures: [{ difficulty: 3, label: 'ARS', tone: 'tertiary' }],
              form: 7.4,
              position: 'FWD',
              team: 'ARS',
            }}
            points={8}
          />
          <PlayerCard
            formPosition="beside"
            layout="list"
            player={{ displayName: "Viktor Gyökeres", fixtures: [{ difficulty: 3, label: 'ARS' }], form: 7.4, position: 'FWD', team: 'ARS' }}
          />
        </>,
      );
    });

    expect(container.querySelectorAll('.player-card__token')).toHaveLength(2);
    expect(container.querySelectorAll('.player-card__token--with-opponent')).toHaveLength(2);
    expect(container.querySelectorAll('.player-card__shirt-crop img')).toHaveLength(2);
    expect(container.querySelectorAll('.player-card__name')).toHaveLength(2);
    expect(container.querySelectorAll('.player-card__points')).toHaveLength(1);
    expect(container.querySelector('.player-card__points')?.textContent).toBe('8');
    expect(container.querySelectorAll('.player-card__opponent--fdr-3')).toHaveLength(2);
    expect(container.querySelector('.player-card__opponent')?.classList).toContain('player-card__opponent--theme-tertiary');
    expect(container.querySelector('.player-card--pitch.player-card--form-below')).not.toBeNull();
    expect(container.querySelector('.player-card--list.player-card--form-beside')).not.toBeNull();
    expect(container.querySelector('.player-card__role')?.textContent).toBe('C');
    expect(container.querySelector('.player-card__availability')?.getAttribute('aria-label')).toBe('75% chance of playing');
  });

  test('uses the full opponent row and splits double-gameweek fixtures evenly', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ container, root });

    act(() => {
      root.render(
        <>
          <PlayerCard
            layout="token"
            player={{
              displayName: 'M. Santos',
              fixtures: [
                { difficulty: 3, label: 'bha' },
                { difficulty: 4, label: 'ARS' },
              ],
              team: 'ARS',
            }}
          />
          <PlayerCard
            layout="token"
            player={{ displayName: 'Single Fixture', fixtures: [{ difficulty: 3, label: 'CHE' }], team: 'ARS' }}
          />
        </>,
      );
    });

    const opponents = container.querySelectorAll('.player-card__opponents');
    expect(opponents[0]?.className).toContain('player-card__opponents--multiple');
    expect(opponents[0]?.getAttribute('data-fixture-count')).toBe('2');
    expect(opponents[0]?.children).toHaveLength(2);
    expect(opponents[0]?.children[0]?.className).toContain('player-card__opponent--fdr-3');
    expect(opponents[0]?.children[1]?.className).toContain('player-card__opponent--fdr-4');
    expect(opponents[1]?.className).toContain('player-card__opponents--single');
    expect(opponents[1]?.getAttribute('data-fixture-count')).toBe('1');
  });

  test('shows a points multiplier only when it is greater than one', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ container, root });

    act(() => {
      root.render(
        <>
          <PlayerCard layout="pitch" player={{ displayName: 'Captain', team: 'ARS' }} points={8} pointsMultiplier={2} />
          <PlayerCard layout="pitch" player={{ displayName: 'Player', team: 'ARS' }} points={6} pointsMultiplier={1} />
        </>,
      );
    });

    expect(container.querySelectorAll('.player-card__points')[0]?.textContent).toBe('8 ×2');
    expect(container.querySelectorAll('.player-card__points')[1]?.textContent).toBe('6');
    expect(container.querySelector('.player-card__points')?.getAttribute('aria-label')).toBe('8 points multiplied by 2');
  });

  test('keeps ordinary pitch shirts full while cropping points cards unless explicitly overridden', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ container, root });

    act(() => {
      root.render(
        <>
          <PlayerCard layout="pitch" player={{ displayName: 'Squad player', team: 'ARS' }} />
          <PlayerCard layout="pitch" player={{ displayName: 'Fixture player', team: 'ARS' }} points={6} />
          <PlayerCard cropShirt layout="pitch" player={{ displayName: 'Forced crop', team: 'ARS' }} />
          <PlayerCard cropShirt={false} layout="pitch" player={{ displayName: 'Forced full', team: 'ARS' }} points={6} />
        </>,
      );
    });

    const cards = container.querySelectorAll('.player-card--pitch');
    expect(cards[0]?.className).toContain('player-card--shirt-full');
    expect(cards[1]?.className).toContain('player-card--shirt-cropped');
    expect(cards[2]?.className).toContain('player-card--shirt-cropped');
    expect(cards[3]?.className).toContain('player-card--shirt-full');
  });
});
