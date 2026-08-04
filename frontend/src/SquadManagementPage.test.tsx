import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { SquadManagementPage } from './SquadManagementPage';
import { getDefaultThemePreset } from './theme-presets';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/squad/summary') {
        return new Response(
          JSON.stringify({
            manager_team: { name: 'Exeter Gently' },
            gameweek: { name: 'Gameweek 1' },
            players: [
              {
                id: 'fpl-411',
                display_name: 'Haaland',
                position: 'FWD',
                epl_team: { name: 'Manchester City', short_name: 'MCI' },
                status: 'owned',
                points: 0,
                value: 0,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (path === '/api/scouting/players') {
        return new Response(
          JSON.stringify({
            players: [
              {
                id: 'fpl-411',
                display_name: 'Haaland',
                position: 'FWD',
                epl_team: { name: 'Manchester City', short_name: 'MCI' },
                status: 'owned',
                points: 0,
                value: 0,
              },
              {
                id: 'fpl-154',
                display_name: 'Palmer',
                position: 'MID',
                epl_team: { name: 'Chelsea', short_name: 'CHE' },
                status: 'available',
                points: 0,
                value: 0,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (path === '/api/interests' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'interest-player-3',
            player: { id: 'fpl-154', display_name: 'Palmer' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (path === '/api/trades') {
        return new Response(JSON.stringify({ trades: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

async function renderPage() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SquadManagementPage preset={getDefaultThemePreset()} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

describe('SquadManagementPage', () => {
  test('renders squad summary and scouting table', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Squad, scouting, interests, and transfers');
    expect(container.textContent).toContain('Total players');
    expect(container.textContent).toContain('Exeter Gently');
    expect(container.textContent).toContain('Haaland');
    expect(container.textContent).toContain('Palmer');
  });

  test('filters scouting players and creates interests', async () => {
    const { container } = await renderPage();
    const input = container.querySelector('input[aria-label="Search players"]') as HTMLInputElement;

    await act(async () => {
      input.value = 'palmer';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(input.value).toBe('palmer');
    expect(container.textContent).toContain('Palmer');

    const interestButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Interest') && !button.disabled) as HTMLButtonElement;
    await act(async () => {
      interestButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('added to interests');
    expect(container.textContent).toContain('Palmer');
  });

  test('opens player detail without exposing the obsolete sample trade action', async () => {
    const { container } = await renderPage();
    expect(container.textContent).not.toContain('Propose sample trade');
    const playerButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Palmer')) as HTMLButtonElement;
    await act(async () => {
      playerButton.click();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Palmer');
  });
});
