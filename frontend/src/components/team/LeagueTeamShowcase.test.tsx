import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';
import { LeagueTeamShowcase } from './LeagueTeamShowcase';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('LeagueTeamShowcase', () => {
  afterEach(() => document.body.replaceChildren());

  test('shows all eight crests and changes the selected team', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<LeagueTeamShowcase rows={[]} />));

    expect(container.querySelectorAll('.league-team-showcase__team')).toHaveLength(8);
    expect(container.querySelector('h2')?.textContent).toBe('Stan Still Sells Tik');
    const wildeBoars = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Wilde Boars'));
    expect(wildeBoars).toBeTruthy();
    act(() => wildeBoars?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.querySelector('h2')?.textContent).toBe('Wilde Boars');
    expect(wildeBoars?.getAttribute('aria-pressed')).toBe('true');
    act(() => root.unmount());
  });
});
