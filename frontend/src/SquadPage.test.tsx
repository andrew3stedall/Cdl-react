import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { SquadPage } from './SquadPage';
import { getDefaultThemePreset } from './theme-presets';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/squad/summary') {
        return new Response(JSON.stringify({
          manager_team: { id: 'team-1', name: 'Exeter Gently', short_name: 'EXE' },
          gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
          players: [
            {
              id: 'fpl-411',
              display_name: 'Haaland',
              position: 'FWD',
              epl_team: { id: 'mci', name: 'Manchester City', short_name: 'MCI' },
              draft_team: { id: 'team-1', name: 'Exeter Gently', short_name: 'EXE' },
              status: 'owned',
              points: 52,
              form: 7.4,
              value: 14.0,
              selected_by_percent: 62.1,
            },
            {
              id: 'fpl-235',
              display_name: 'Pickford',
              position: 'GKP',
              epl_team: { id: 'eve', name: 'Everton', short_name: 'EVE' },
              draft_team: { id: 'team-1', name: 'Exeter Gently', short_name: 'EXE' },
              status: 'owned',
              points: 31,
              form: 4.8,
              value: 5.0,
              selected_by_percent: 18.0,
            },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (path === '/api/team-selection') {
        return new Response(JSON.stringify({
          manager_team: { id: 'team-1', name: 'Exeter Gently', short_name: 'EXE' },
          gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
          lineup: [
            {
              id: 'fpl-411',
              display_name: 'Haaland',
              position: 'FWD',
              epl_team: { id: 'mci', name: 'Manchester City', short_name: 'MCI' },
              slot: 'starter',
              slot_order: 1,
              is_captain: true,
              is_vice_captain: false,
            },
            {
              id: 'fpl-235',
              display_name: 'Pickford',
              position: 'GKP',
              epl_team: { id: 'eve', name: 'Everton', short_name: 'EVE' },
              slot: 'bench',
              slot_order: 1,
              is_captain: false,
              is_vice_captain: false,
            },
          ],
          chips: [],
          fixture_lock: { locked: false, fixture_id: null, fixture_type: null, lock_scope: null, locked_at: null, reason: null },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (path === '/api/scouting/players') {
        return new Response(JSON.stringify({
          players: [
            {
              id: 'fpl-411',
              display_name: 'Haaland',
              position: 'FWD',
              epl_team: { id: 'mci', name: 'Manchester City', short_name: 'MCI' },
              draft_team: { id: 'team-1', name: 'Exeter Gently', short_name: 'EXE' },
              status: 'owned',
              points: 52,
              form: 7.4,
              value: 14.0,
              selected_by_percent: 62.1,
            },
            {
              id: 'fpl-235',
              display_name: 'Pickford',
              position: 'GKP',
              epl_team: { id: 'eve', name: 'Everton', short_name: 'EVE' },
              draft_team: { id: 'team-1', name: 'Exeter Gently', short_name: 'EXE' },
              status: 'owned',
              points: 31,
              form: 4.8,
              value: 5.0,
            },
            {
              id: 'fpl-154',
              display_name: 'Palmer',
              position: 'MID',
              epl_team: { id: 'che', name: 'Chelsea', short_name: 'CHE' },
              draft_team: { id: 'team-2', name: 'Castle FC', short_name: 'CAS' },
              status: 'owned',
              points: 48,
              form: 8.1,
              value: 10.5,
              selected_by_percent: 49.0,
            },
            {
              id: 'fpl-999',
              display_name: 'Free Agent',
              position: 'FWD',
              epl_team: { id: 'ars', name: 'Arsenal', short_name: 'ARS' },
              draft_team: null,
              status: 'available',
              points: 22,
              form: 3.1,
              value: 5.5,
            },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (path === '/api/trades') {
        return new Response(JSON.stringify({ trades: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.body.replaceChildren();
});

async function renderPage() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SquadPage preset={getDefaultThemePreset()} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

function buttonByText(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent?.includes(text)) as HTMLButtonElement | undefined;
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SquadPage', () => {
  test('opens as a season squad workspace and remembers pitch/list choice', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Exeter Gently');
    expect(container.textContent).toContain('Total Points');
    expect(container.textContent).toContain('Form (Last 5)');
    expect(container.textContent).toContain('API needed');
    expect(container.querySelector('[aria-label="Squad pitch"]')).not.toBeNull();
    expect(container.querySelector('img[src="/team-shirts/mci.svg"]')).not.toBeNull();
    expect(container.textContent).not.toContain('PostgreSQL');

    await act(async () => {
      buttonByText(container, 'List').click();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Squad players table"]')).not.toBeNull();
    expect(window.localStorage.getItem('cdl:squad-view')).toBe('list');

    await act(async () => {
      buttonByText(container, 'FWD').click();
      await Promise.resolve();
    });

    const table = container.querySelector('[aria-label="Squad players table"]');
    expect(table?.textContent).toContain('Haaland');
    expect(table?.textContent).not.toContain('Pickford');
  });

  test('compares manually selected players in selection order', async () => {
    const { container } = await renderPage();
    const haaland = container.querySelector('button[aria-label="View Haaland details"]') as HTMLButtonElement;

    await act(async () => {
      haaland.click();
      await Promise.resolve();
    });
    expect(container.querySelector('.squad-page__drawer')?.textContent).toContain('Release to Free Agency');

    await act(async () => {
      buttonByText(container, 'Compare').click();
      await Promise.resolve();
    });

    const search = container.querySelector('input[aria-label="Search comparison players"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(search, 'Palmer');
      await Promise.resolve();
    });

    await act(async () => {
      buttonByText(container, 'Palmer').click();
      await Promise.resolve();
    });

    const cards = Array.from(container.querySelectorAll('.squad-page__compare-card'));
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Haaland');
    expect(cards[1].textContent).toContain('Palmer');
  });

  test('stages removals and validates the complete change set only at submission', async () => {
    const { container } = await renderPage();
    const haaland = container.querySelector('button[aria-label="View Haaland details"]') as HTMLButtonElement;

    await act(async () => {
      haaland.click();
      await Promise.resolve();
    });
    await act(async () => {
      buttonByText(container, 'Release to Free Agency').click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Haaland staged for removal.');
    const changes = container.querySelector('[aria-label="Squad changes"]');
    expect(changes?.textContent).toContain('Pending Removal');
    expect(changes?.textContent).toContain('Removed');
    expect(changes?.textContent).toContain('Haaland');

    await act(async () => {
      buttonByText(container, 'Submit Squad Changes').click();
      await Promise.resolve();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Add 1 draw-won player before confirming.');

    await act(async () => {
      buttonByText(container, 'Back').click();
      await Promise.resolve();
    });
    await act(async () => {
      buttonByText(container, 'Restore to Squad').click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Haaland restored to the squad.');
  });
});