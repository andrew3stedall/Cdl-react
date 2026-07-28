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
      if (path === '/api/interests' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'interest-player-3',
            player: { id: 'player-3', display_name: 'Casey Midfielder' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (path === '/api/trades' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'trade-1',
            status: 'proposed',
            assets: [
              { player: { display_name: 'Alex Keeper' } },
              { player: { display_name: 'Dev Forward' } },
            ],
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
    expect(container.textContent).toContain('Alex Keeper');
    expect(container.textContent).toContain('Casey Midfielder');
  });

  test('filters scouting players and creates interests', async () => {
    const { container } = await renderPage();
    const input = container.querySelector('input[aria-label="Search players"]') as HTMLInputElement;

    await act(async () => {
      input.value = 'casey';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(input.value).toBe('casey');
    expect(container.textContent).toContain('Casey Midfielder');

    const interestButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Interest')) as HTMLButtonElement;
    await act(async () => {
      interestButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('added to interests');
    expect(container.textContent).toContain('Casey Midfielder');
  });

  test('creates a persisted trade and opens player detail', async () => {
    const { container } = await renderPage();
    const tradeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Propose sample trade') as HTMLButtonElement;

    await act(async () => {
      tradeButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Trade proposal created.');
    expect(container.textContent).toContain('Trade proposed: Alex Keeper ↔ Dev Forward');

    const playerButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Casey Midfielder')) as HTMLButtonElement;
    await act(async () => {
      playerButton.click();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Casey Midfielder');
  });
});
