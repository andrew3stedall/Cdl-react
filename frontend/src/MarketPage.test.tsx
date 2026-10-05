import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MarketPage } from './MarketPage';
import { getDefaultThemePreset } from './theme-presets';
import type { SessionState } from './contracts';

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
let approvalTrades: Array<Record<string, unknown>> = [];
let marketDraws: Array<Record<string, unknown>> = [];
let failedMarketReads = new Set<string>();
let marketHistory: Array<Record<string, unknown>> = [];

beforeEach(() => {
  marketPlayers = [player];
  interestActive = false;
  marketTrades = [];
  savedDrawPlayerIds = [];
  approvalTrades = [];
  marketDraws = [{ id: 'draw-1', season_id: 1, gameweek: 1, status: 'open_for_preferences', opens_at: null, closes_at: '2026-10-10T12:00:00Z', processed_at: null, draw_order: [] }];
  failedMarketReads = new Set();
  marketHistory = [{ gameweek: 9, fixture_id: 900, total_points: 9, minutes: 90, expected_goals: 0.84, expected_assists: 0.12 }];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if ((!init?.method || init.method === 'GET') && failedMarketReads.has(path)) {
      return new Response(JSON.stringify({ message: 'Temporary market read failure.' }), { status: 503 });
    }
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
    if (path.startsWith('/api/fpl/players/')) return new Response(JSON.stringify({ history: marketHistory, fixtures: [] }), { status: 200 });
    if (path === '/api/trades/approvals') return new Response(JSON.stringify({ trades: approvalTrades }), { status: 200 });
    if (path.endsWith('/approve') && init?.method === 'POST') {
      const decision = (JSON.parse(String(init.body)) as { decision: string }).decision;
      approvalTrades = [];
      return new Response(JSON.stringify({ id: 'trade-approval', status: 'accepted', approval_status: decision, executed_at: decision === 'approved' ? '2026-10-03T12:00:00Z' : null }), { status: 200 });
    }
    if (path === '/api/free-agency/draws' && init?.method === 'POST') {
      const payload = JSON.parse(String(init.body)) as { gameweek: number; opens_at?: string; closes_at: string };
      const created = { id: 'draw-2', season_id: 1, gameweek: payload.gameweek, status: 'scheduled', opens_at: payload.opens_at ?? null, closes_at: payload.closes_at, processed_at: null, draw_order: [] };
      marketDraws = [created, ...marketDraws];
      return new Response(JSON.stringify(created), { status: 200 });
    }
    if (path === '/api/free-agency/draws') return new Response(JSON.stringify(marketDraws), { status: 200 });
    if (path.startsWith('/api/free-agency/draws/draw-1/') && init?.method === 'POST') {
      const action = path.split('/').at(-1);
      const draw = marketDraws.find((candidate) => candidate.id === 'draw-1');
      if (draw) draw.status = action === 'lock' ? 'locked' : action === 'open' ? 'open_for_preferences' : 'processed';
      return new Response(JSON.stringify(draw), { status: 200 });
    }
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

async function renderPage(currentPath = '/scouting', session?: SessionState) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<MarketPage currentPath={currentPath} onNavigate={vi.fn()} preset={getDefaultThemePreset()} session={session} />);
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
    const { container, root } = await renderPage('/scouting/draws');
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
    act(() => root.unmount());
  });

  test('shows a role-matched trade approval queue and reports committed ownership changes', async () => {
    approvalTrades = [{
      id: 'trade-approval',
      status: 'accepted',
      offered_by: { id: 'team-a', name: 'Team A' },
      offered_to: { id: 'team-b', name: 'Team B' },
      approval_status: 'pending',
      required_approver_role: 'vice_commissioner',
      assets: [{ player: { display_name: 'Casey Midfielder' } }],
    }];
    const viceSession: SessionState = {
      isAuthenticated: true,
      user: { id: 'vice-1', email: 'vice@example.com', displayName: 'Vice', roles: ['manager', 'vice_commissioner'] },
      expiresAt: null,
    };
    const { container, root } = await renderPage('/scouting/trades', viceSession);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(container.querySelector('[aria-label="Trade approvals"]')?.textContent).toContain('Requires Vice commissioner approval');
    const approve = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Approve');
    await act(async () => { approve?.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain('Trade approved and ownership updated.');
    act(() => root.unmount());
  });

  test('shows commissioner lifecycle controls only to commissioners and gates processing until close', async () => {
    const commissionerSession: SessionState = {
      isAuthenticated: true,
      user: { id: 'comm-1', email: 'comm@example.com', displayName: 'Commissioner', roles: ['manager', 'commissioner'] },
      expiresAt: null,
    };
    const commissioner = await renderPage('/scouting/draws', commissionerSession);
    const { container } = commissioner;
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(container.querySelector('[aria-label="Commissioner draw controls"]')).not.toBeNull();
    await act(async () => {
      Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Lock draw')?.click();
      await Promise.resolve();
    });
    const processButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Process draw');
    expect(processButton?.hasAttribute('disabled')).toBe(true);

    const managerSession: SessionState = {
      isAuthenticated: true,
      user: { id: 'manager-2', email: 'manager@example.com', displayName: 'Manager', roles: ['manager'] },
      expiresAt: null,
    };
    const manager = await renderPage('/scouting/draws', managerSession);
    expect(manager.container.querySelector('[aria-label="Commissioner draw controls"]')).toBeNull();
    act(() => { commissioner.root.unmount(); manager.root.unmount(); });
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

  test('uses the canonical player profile surface from Scouting with contextual actions', async () => {
    const { container } = await renderPage('/scouting');
    const player = container.querySelector('tr[aria-label="View Casey Midfielder details"]') as HTMLTableRowElement;
    await act(async () => {
      player.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.querySelector('main.player-profile[data-presentation="drawer"]')).not.toBeNull();
    expect(dialog?.querySelector('[aria-label="Scouting player actions"]')).not.toBeNull();
    expect(dialog?.textContent).toContain('Casey Midfielder');
    expect(dialog?.textContent).not.toContain('Owner');
    expect(dialog?.textContent).not.toContain('Market workspace');
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

  test('shows official FPL history in the shared player profile chart', async () => {
    const { container } = await renderPage('/scouting');
    const player = container.querySelector('tr[aria-label="View Casey Midfielder details"]') as HTMLTableRowElement;
    await act(async () => {
      player.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const dialog = container.querySelector('[role="dialog"]');
    const chart = dialog?.querySelector('[data-chart-kind="combined-form-minutes"]');
    expect(chart).not.toBeNull();
    expect(chart?.getAttribute('aria-label')).toContain('Fantasy points above the zero line');
    expect(dialog?.querySelector('button[aria-label*="9 points"]')).not.toBeNull();
  });

  test('keeps failed Market reads distinct from empty states and retries them in place', async () => {
    failedMarketReads.add('/api/interests');
    const interestsPage = await renderPage('/scouting/interests');
    const interestsPanel = interestsPage.container.querySelector('section[aria-label="Your Interests"]') as HTMLElement;
    expect(interestsPanel.textContent).toContain('Interests unavailable.');
    expect(interestsPanel.textContent).not.toContain('No Interests');

    failedMarketReads.delete('/api/interests');
    await act(async () => {
      Array.from(interestsPanel.querySelectorAll('button')).find((button) => button.textContent === 'Retry')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(interestsPanel.textContent).toContain('No Interests');
    expect(interestsPanel.textContent).not.toContain('Interests unavailable.');
    act(() => interestsPage.root.unmount());

    failedMarketReads.add('/api/trades');
    const tradesPage = await renderPage('/scouting/trades');
    const tradesPanel = tradesPage.container.querySelector('section[aria-label="Trade activity"]') as HTMLElement;
    expect(tradesPanel.textContent).toContain('Trade activity unavailable.');
    expect(tradesPanel.textContent).not.toContain('No trade proposals');

    failedMarketReads.delete('/api/trades');
    await act(async () => {
      Array.from(tradesPanel.querySelectorAll('button')).find((button) => button.textContent === 'Retry')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(tradesPanel.textContent).toContain('No trade proposals');
    expect(tradesPanel.textContent).not.toContain('Trade activity unavailable.');
    act(() => tradesPage.root.unmount());
  });

  test('refreshes corrected same-gameweek history in the shared profile', async () => {
    marketHistory = [{ gameweek: 9, fixture_id: 900, total_points: 2, minutes: 45, expected_goals: 0.1, expected_assists: 0.05 }];
    const { container, root } = await renderPage('/scouting');
    const openPlayer = () => container.querySelector('tr[aria-label="View Casey Midfielder details"]') as HTMLTableRowElement;

    await act(async () => {
      openPlayer().click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[role="dialog"] button[aria-label*="2 points"]')).not.toBeNull();

    await act(async () => {
      (container.querySelector('button[aria-label="Close player details"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    marketHistory = [
      { gameweek: 9, fixture_id: 900, total_points: 5, minutes: 90, expected_goals: 0.4, expected_assists: 0.1 },
      { gameweek: 9, fixture_id: 901, total_points: 3, minutes: 20, expected_goals: 0.2, expected_assists: 0.3 },
    ];
    await act(async () => {
      openPlayer().click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.querySelector('button[aria-label*="5 points"]')).not.toBeNull();
    expect(dialog?.querySelector('button[aria-label*="3 points"]')).not.toBeNull();
    act(() => root.unmount());
  });
});
