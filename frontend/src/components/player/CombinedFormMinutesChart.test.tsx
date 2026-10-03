import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import { CombinedFormMinutesChart } from './CombinedFormMinutesChart';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('CombinedFormMinutesChart', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  test('marks negative points below zero without plotting their magnitude as a positive bar', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(
      <CombinedFormMinutesChart
        fixtures={[{
          fixtureId: 'fixture-negative',
          position: 'FWD',
          opponentShortName: 'ARS',
          isHome: true,
          fdr: 3,
          fantasyPoints: -2,
          minutesPlayed: 90,
          stats: { goals: 0, assists: 0, cleanSheets: 0, saves: 0, yellowCards: 0, redCards: 0, defensiveContributions: 0, bonusPoints: 0 },
        }]}
        fdrDisplayMode="font"
        fixtureCount={1}
      />,
    ));

    const pointsBar = container.querySelector<HTMLButtonElement>('.player-profile__combined-positive button');
    expect(container.querySelector('.player-profile__chart-value')?.textContent).toBe('-2');
    expect(pointsBar?.dataset.pointsSign).toBe('negative');
    expect(pointsBar?.classList).toContain('player-profile__combined-bar--negative-points');
    expect(pointsBar?.getAttribute('style')).toContain('--bar-height: 0%');
    expect(pointsBar?.getAttribute('aria-label')).toContain('-2 points');
    expect(container.querySelector('.player-profile__combined-negative button')?.getAttribute('aria-label')).toContain('90 minutes');
  });
});
