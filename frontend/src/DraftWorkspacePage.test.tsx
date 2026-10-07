import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { DraftWorkspacePage } from './DraftWorkspacePage';
import type { ThemePreset } from './contracts';

const preset = { name: 'teal-dark', label: 'Teal Dark' } as ThemePreset;

function room(picks: Array<Record<string, unknown>> = []) {
  return {
    id: 'draft-1', status: 'active', mode: 'snake', rounds: 2,
    pick_number: picks.length + 1, current_team_id: 'team-a', current_team_name: 'AFC Test',
    clock_enabled: false, pick_seconds: null, clock_started_at: null, clock_deadline_at: null,
    picks, available_players: [{ id: 'fpl-1', name: 'Striker One', position: 'FWD', cost: 95 }],
    my_queue: [], events: [],
  };
}

describe('DraftWorkspacePage', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    container?.remove();
    container = null;
    vi.unstubAllGlobals();
  });

  test('loads the persistent room and submits an on-clock pick', async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    let picked = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      if (url.endsWith('/availability')) return Response.json({ can_create: true, reason: null });
      if (url.endsWith('/teams')) return Response.json([{ id: 'team-a', name: 'AFC Test' }]);
      if (method === 'POST' && url.endsWith('/pick')) {
        picked = true;
        return Response.json({ id: 'pick-1' });
      }
      return Response.json(picked ? room([{
        pick_number: 1, round_number: 1, team_id: 'team-a', team_name: 'AFC Test',
        player_id: 'fpl-1', player_name: 'Striker One', source: 'manager_manual',
        picked_at: new Date().toISOString(), seconds_taken: null,
      }]) : room());
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<DraftWorkspacePage preset={preset} teamId="team-a" canCommission={false} />);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('AFC Test');
    const pickButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Pick');
    expect(pickButton).toBeDefined();
    await act(async () => {
      pickButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(calls.some((call) => call.url.endsWith('/pick') && call.method === 'POST')).toBe(true);
    expect(container.textContent).toContain('Striker One');
  });

  test('guards draft setup when the configured season already has squad ownerships', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/availability')) {
        return Response.json({ can_create: false, reason: 'active_squad_ownerships' });
      }
      if (url.endsWith('/teams')) return Response.json([{ id: 'team-a', name: 'AFC Test' }]);
      return Response.json(null);
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<DraftWorkspacePage preset={preset} teamId="team-a" canCommission />);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('Starting another draft is disabled to protect them.');
    expect([...container.querySelectorAll('button')].some((button) => button.textContent?.includes('Create draft room'))).toBe(false);
  });

  test('requires the full pick count before completion and hides corrections after completion', async () => {
    const firstPick = {
      pick_number: 1, round_number: 1, team_id: 'team-a', team_name: 'AFC Test',
      player_id: 'fpl-1', player_name: 'Striker One', source: 'manager_manual',
      picked_at: new Date().toISOString(), seconds_taken: null,
    };
    let state = { ...room([firstPick]), status: 'active' };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/availability')) return Response.json({ can_create: true, reason: null });
      if (String(input).endsWith('/teams')) return Response.json([{ id: 'team-a', name: 'AFC Test' }]);
      return Response.json(state);
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<DraftWorkspacePage preset={preset} teamId="team-a" canCommission />);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect([...container.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Complete')).toBe(false);
    expect([...container.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Correct')).toBe(true);

    state = { ...state, status: 'complete' };
    const refreshButton = container.querySelector<HTMLButtonElement>('button[aria-label="Refresh draft room"]');
    await act(async () => {
      refreshButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect([...container.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Correct')).toBe(false);
    expect([...container.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Complete')).toBe(false);
  });
});
