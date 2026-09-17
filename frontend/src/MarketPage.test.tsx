import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MarketPage } from './MarketPage';
import { getDefaultThemePreset } from './theme-presets';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const player = {
  id: 'player-3',
  display_name: 'Casey Midfielder',
  position: 'MID',
  epl_team: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' },
  status: 'available',
  points: 61,
  form: 6.8,
  value: 7.5,
  selected_by_percent: 24.1,
  expected_goals: 5.7,
  expected_assists: 6.1,
  availability_status: 'a',
  availability_news: '',
  chance_of_playing_next_round: 100,
  next_fixture: {
    fixture_id: 'fixture-1',
    gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
    opponent: { id: 'epl-mci', name: 'Manchester City', short_name: 'MCI' },
    difficulty: 3,
    is_home: true,
  },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === '/api/squad/summary') {
      return new Response(JSON.stringify({ manager_team: { name: 'Exeter Gently' }, gameweek: { name: 'Gameweek 1' }, players: [player] }), { status: 200 });
    }
    if (path === '/api/scouting/players') return new Response(JSON.stringify({ players: [player] }), { status: 200 });
    if (path === '/api/interests' && init?.method === 'POST') {
      return new Response(JSON.stringify({ id: 'interest-1', player: { ...player, status: 'interested' }, gameweek: { name: 'Gameweek 1' }, note: null }), { status: 200 });
    }
    if (path === '/api/interests') return new Response(JSON.stringify([]), { status: 200 });
    if (path === '/api/trades') return new Response(JSON.stringify({ trades: [] }), { status: 200 });
    if (path.startsWith('/api/fpl/players/')) return new Response(JSON.stringify({ history: [], fixtures: [] }), { status: 200 });
    return new Response('{}', { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

async function renderPage(currentPath = '/scouting') {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<MarketPage currentPath={currentPath} onNavigate={vi.fn()} preset={getDefaultThemePreset()} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

describe('MarketPage', () => {
  test('keeps discovery focused on the player list', async () => {
    const { container } = await renderPage();

    expect(container.querySelector('h1')?.textContent).toBe('Market');
    expect(container.textContent).toContain('Casey Midfielder');
    expect(container.querySelector('.cdl-page-hero__view-toggle')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Discovery"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).not.toContain('Market workspace');
    expect(container.textContent).not.toContain('Player discovery');
    expect(container.textContent).not.toContain('Official FPL evidence');
    expect(container.querySelector('nav[aria-label="Squad mobile navigation"]')).toBeNull();
  });

  test('presents discovery players in the Squad-style three-column list', async () => {
    const { container } = await renderPage();
    const table = container.querySelector('table[aria-label="Market player results"]');

    expect(table?.querySelectorAll('thead th')).toHaveLength(3);
    expect(table?.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(table?.querySelector('tbody tr td')?.textContent).toContain('Casey Midfielder');
    expect(container.querySelector('.market-page__player-row article')).toBeNull();
    expect(container.querySelector('.player-card__position-marker')).toBeNull();
    const playerCard = table?.querySelector('.market-page__list-player-card');
    expect(playerCard?.classList).toContain('player-card--form-beside');
    expect(playerCard?.lastElementChild?.classList.contains('player-card__form')).toBe(true);
    expect(table?.querySelector('.market-page__expected')).not.toBeNull();
    expect(table?.textContent).not.toContain('Status');
    expect(table?.textContent).not.toContain('Owned');
  });

  test('keeps only position and fixture filters, then persists an Interest action from player details', async () => {
    const { container } = await renderPage();
    const search = container.querySelector('input[aria-label="Search market players"]') as HTMLInputElement;

    await act(async () => {
      search.value = 'Casey';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });

    const filterButton = container.querySelector('button[aria-label="Open market filters"]') as HTMLButtonElement;
    await act(async () => {
      filterButton.click();
      await Promise.resolve();
    });
    expect(container.querySelector('select[aria-label="Filter market by ownership"]')).toBeNull();
    expect(container.querySelector('select[aria-label="Filter market by position"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Filter market by fixture difficulty"]')).not.toBeNull();

    const playerRow = container.querySelector('tr[aria-label="View Casey Midfielder details"]') as HTMLTableRowElement;
    await act(async () => {
      playerRow.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    const interest = container.querySelector('button[aria-label="Add Casey Midfielder to Interests"]') as HTMLButtonElement;
    expect(interest).toBeDefined();
    await act(async () => {
      interest.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Casey Midfielder added to Interests.');
    expect(container.querySelector('button[aria-label="Add Casey Midfielder to Interests"]')).toBeNull();
    expect(container.textContent).not.toContain('In Interests');
  });

  test('opens player details without an availability or ownership field', async () => {
    const { container } = await renderPage('/scouting/interests');
    expect(container.querySelector('section[aria-label="Your Interests"]')?.textContent).toContain('No Interests');

    const { container: discoveryContainer } = await renderPage('/scouting');
    const player = discoveryContainer.querySelector('tr[aria-label="View Casey Midfielder details"]') as HTMLTableRowElement;
    await act(async () => {
      player.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(discoveryContainer.querySelector('[role="dialog"]')?.textContent).toContain('Casey Midfielder');
    expect(discoveryContainer.querySelector('[role="dialog"]')?.textContent).toContain('Next fixture');
    expect(discoveryContainer.querySelector('[role="dialog"]')?.textContent).not.toContain('Availability');
    expect(discoveryContainer.querySelector('[role="dialog"]')?.textContent).not.toContain('Owned');
  });
});
