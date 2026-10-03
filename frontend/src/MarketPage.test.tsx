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

const ownedPlayer = {
  ...player,
  id: 'player-4',
  display_name: 'Owned Defender',
  position: 'DEF',
  status: 'owned',
  draft_team: { id: 'team-exeter-gently', name: 'Exeter Gently', short_name: 'EXE' },
};

const otherOwnedPlayer = {
  ...player,
  id: 'player-5',
  display_name: 'Other Owned Midfielder',
  status: 'owned',
  draft_team: { id: 'team-bayer-neverlusen', name: 'Bayer Nerverlusen', short_name: 'BAY' },
};

let marketPlayers = [player];
let interestActive = false;
let marketTrades: Array<Record<string, unknown>> = [];
let savedDrawPlayerIds: string[] = [];

beforeEach(() => {
  marketPlayers = [player];
  interestActive = false;
  marketTrades = [];
  savedDrawPlayerIds = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === '/api/squad/summary') {
      return new Response(JSON.stringify({ manager_team: { id: 'team-exeter-gently', name: 'Exeter Gently' }, gameweek: { name: 'Gameweek 1' }, players: [player] }), { status: 200 });
    }
    if (path === '/api/scouting/players') return new Response(JSON.stringify({ players: marketPlayers }), { status: 200 });
    if (path === '/api/interests' && init?.method === 'POST') {
      interestActive = true;
      return new Response(JSON.stringify({ id: 'interest-1', player: { ...player, status: 'interested' }, gameweek: { name: 'Gameweek 1' }, note: null }), { status: 200 });
    }
    if (path === '/api/interests/interest-1' && init?.method === 'DELETE') {
      interestActive = false;
      return new Response(JSON.stringify({ deleted_interest_id: 'interest-1' }), { status: 200 });
    }
    if (path === '/api/interests') return new Response(JSON.stringify(interestActive ? [{ id: 'interest-1', player: { ...player, status: 'interested' }, gameweek: { name: 'Gameweek 1' }, note: null }] : []), { status: 200 });
    if (path.startsWith('/api/trades/') && init?.method === 'PUT') {
      const trade = marketTrades.find((item) => item.id === path.split('/').at(-1));
      if (trade) trade.status = (JSON.parse(String(init.body)) as { status: string }).status;
      return new Response(JSON.stringify(trade ?? {}), { status: 200 });
    }
    if (path === '/api/trades') return new Response(JSON.stringify({ trades: marketTrades }), { status: 200 });
    if (path.startsWith('/api/fpl/players/')) return new Response(JSON.stringify({ history: [{ gameweek: 9, fixture_id: 900, total_points: 9, minutes: 90, expected_goals: 0.84, expected_assists: 0.12 }], fixtures: [] }), { status: 200 });
    if (path === '/api/free-agency/draws') return new Response(JSON.stringify([{ id: 'draw-1', season_id: 1, gameweek: 1, status: 'open_for_preferences', opens_at: null, closes_at: '2026-10-10T12:00:00Z', processed_at: null, draw_order: [] }]), { status: 200 });
    if (path === '/api/free-agency/draws/draw-1/preferences' && init?.method === 'PUT') {
      savedDrawPlayerIds = (JSON.parse(String(init.body)) as { player_ids: string[] }).player_ids;
      return new Response(JSON.stringify(savedDrawPlayerIds.map((player_id, index) => ({ player_id, rank: index + 1 }))), { status: 200 });
    }
    if (path === '/api/free-agency/draws/draw-1/preferences') return new Response(JSON.stringify([]), { status: 200 });
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

  test('submits an ordered private preference list for an open draw', async () => {
    const { container } = await renderPage('/scouting/draws');
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(container.textContent).toContain('Gameweek 1');
    expect(container.textContent).toContain('Rank your player preferences');
    await act(async () => {
      (container.querySelector('.market-page__draw-candidates button') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      (container.querySelector('button') as HTMLButtonElement);
      const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save preferences');
      saveButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(savedDrawPlayerIds).toEqual(['player-3']);
    expect(container.textContent).toContain('Only your team can view this ranked list.');
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
    expect(table?.querySelector('.player-card__opponents')?.textContent).toBe('Free');
    expect(table?.querySelector('.player-card__opponent')?.classList).toContain('player-card__opponent--theme-secondary');
    expect(table?.textContent).not.toContain('Status');
    expect(table?.textContent).not.toContain('Owned');
  });

  test('shows the owning manager instead of the next fixture with ownership tones', async () => {
    marketPlayers = [player, ownedPlayer, otherOwnedPlayer];
    const { container } = await renderPage();
    const ownedRow = container.querySelector('tr[aria-label="View Owned Defender details"]');
    const otherOwnedRow = container.querySelector('tr[aria-label="View Other Owned Midfielder details"]');

    expect(ownedRow?.querySelector('.player-card__opponents')?.textContent).toBe('Dilson');
    expect(ownedRow?.textContent).not.toContain('MCI');
    expect(ownedRow?.querySelector('.player-card__opponent')?.classList).toContain('player-card__opponent--theme-primary');
    expect(otherOwnedRow?.querySelector('.player-card__opponent')?.classList).toContain('player-card__opponent--theme-tertiary');
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
    const remove = container.querySelector('button[aria-label="Remove Casey Midfielder from Interests"]') as HTMLButtonElement;
    await act(async () => {
      remove.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('button[aria-label="Add Casey Midfielder to Interests"]')).not.toBeNull();
    (container.querySelector('button[aria-label="Close player details"]') as HTMLButtonElement).click();
    await act(async () => {
      (container.querySelector('tr[aria-label="View Casey Midfielder details"]') as HTMLTableRowElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('button[aria-label="Add Casey Midfielder to Interests"]')).not.toBeNull();
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
    expect(discoveryContainer.querySelector('[role="dialog"]')?.textContent).toContain('Owner');
    expect(discoveryContainer.querySelector('[role="dialog"]')?.textContent).toContain('Free');
    expect(discoveryContainer.querySelector('[role="dialog"]')?.textContent).not.toContain('Next fixture');
    expect(discoveryContainer.querySelector('[role="dialog"]')?.textContent).not.toContain('Availability');
    expect(discoveryContainer.querySelector('[role="dialog"]')?.textContent).not.toContain('Owned');
  });

  test('offers authorised trade responses and explains that acceptance awaits commissioner approval', async () => {
    marketTrades = [{
      id: 'trade-1',
      status: 'proposed',
      offered_by: { id: 'team-other', name: 'Other FC' },
      offered_to: { id: 'team-exeter-gently', name: 'Exeter Gently' },
      assets: [],
    }];
    const { container } = await renderPage('/scouting/trades');
    const accept = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Accept') as HTMLButtonElement;
    expect(accept).toBeDefined();
    await act(async () => {
      accept.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Commissioner approval is still required');
    expect(container.textContent).toContain('Awaiting commissioner approval');
    expect(container.querySelector('button')?.textContent).not.toContain('Reject');
  });

  test('shows official FPL evidence and accessible form history in player details', async () => {
    const { container } = await renderPage('/scouting');
    const player = container.querySelector('tr[aria-label="View Casey Midfielder details"]') as HTMLTableRowElement;
    await act(async () => {
      player.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const drawer = container.querySelector('[role="dialog"]');
    expect(drawer?.querySelector('[aria-label="Player metrics"]')?.textContent).toContain('5.7');
    expect(drawer?.querySelector('[aria-label="Recent FPL gameweek history"]')?.textContent).toContain('0.84');
    expect(drawer?.querySelector('.player-card__form-dots')?.getAttribute('aria-label')).toContain('Gameweek 9: 9 points, 90 minutes');
    expect(drawer?.textContent).toContain('OwnerFree');
  });
});
