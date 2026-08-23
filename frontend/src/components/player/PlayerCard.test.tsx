import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import { PlayerCard } from './PlayerCard';

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
              fixtures: [{ difficulty: 3, label: 'ARS' }],
              form: 7.4,
              position: 'FWD',
              team: 'ARS',
            }}
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
    expect(container.querySelectorAll('.player-card__shirt-crop img')).toHaveLength(2);
    expect(container.querySelectorAll('.player-card__name')).toHaveLength(2);
    expect(container.querySelectorAll('.player-card__opponent--fdr-3')).toHaveLength(2);
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
});
