import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { TeamSelectionPage } from './TeamSelectionPage';
import type {
  TeamSelectionClient,
  TeamSelectionFixtureSummary,
  TeamSelectionPlayer,
  TeamSelectionSnapshot,
} from './team-selection-api';
import { getDefaultThemePreset } from './theme-presets';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const fixtureSummary: TeamSelectionFixtureSummary = {
  cdlFixtures: [],
  eplFixtures: [],
  cdlTable: [],
  eplTable: [],
};

function snapshot(locked = false): TeamSelectionSnapshot {
  return {
    managerTeam: { id: 'team-castle', name: 'Castle FC', shortName: 'CFC' },
    gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1, deadlineAt: '2026-08-14T17:30:00Z' },
    players: [
      { id: 'player-1', name: 'Alex Keeper', position: 'GKP', team: 'ARS', slot: 'starter', slotOrder: 1, captain: false, viceCaptain: false },
      { id: 'player-2', name: 'Ben Defender', position: 'DEF', team: 'MCI', slot: 'starter', slotOrder: 2, captain: false, viceCaptain: false },
      { id: 'player-3', name: 'Casey Midfielder', position: 'MID', team: 'ARS', slot: 'starter', slotOrder: 3, captain: true, viceCaptain: false },
      { id: 'player-4', name: 'Riley Forward', position: 'FWD', team: 'MCI', slot: 'bench', slotOrder: 1, captain: false, viceCaptain: true },
      { id: 'player-5', name: 'Morgan Reserve', position: 'MID', team: 'ARS', slot: 'reserve', slotOrder: 1, captain: false, viceCaptain: false },
    ],
    chips: [
      { id: 'wildcard', name: 'Wildcard', status: 'available' },
      { id: 'bench-boost', name: 'Bench Boost', status: 'used' },
      { id: 'triple-captain', name: 'Triple Captain', status: 'available' },
    ],
    fixtureLock: {
      locked,
      fixtureId: locked ? 'fixture-1' : null,
      fixtureType: locked ? 'epl' : null,
      lockScope: locked ? 'gameweek' : null,
      lockedAt: locked ? '2026-07-26T09:00:00Z' : null,
      reason: locked ? 'FPL deadline passed.' : null,
    },
  };
}

class MemoryTeamSelectionClient implements TeamSelectionClient {
  current: TeamSelectionSnapshot;

  constructor(locked = false) {
    this.current = snapshot(locked);
  }

  async getTeamSelection(): Promise<TeamSelectionSnapshot> {
    return structuredClone(this.current);
  }

  async getFixtureSummary(): Promise<TeamSelectionFixtureSummary> {
    return structuredClone(fixtureSummary);
  }

  async saveLineup(players: TeamSelectionPlayer[]): Promise<TeamSelectionSnapshot> {
    this.current = { ...this.current, players: structuredClone(players) };
    return structuredClone(this.current);
  }

  async updateChip(chipId: string, active: boolean): Promise<TeamSelectionSnapshot> {
    this.current = {
      ...this.current,
      chips: this.current.chips.map((chip) =>
        chip.id === chipId ? { ...chip, status: active ? 'active' : 'available' } : chip,
      ),
    };
    return structuredClone(this.current);
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    const players = snapshot().players.map((player) => ({
      id: player.id,
      display_name: player.name,
      position: player.position,
      epl_team: { name: player.team, short_name: player.team },
      status: 'owned',
      points: 10,
      form: 5,
      value: 5,
    }));
    if (path === '/api/squad/summary' || path === '/api/scouting/players') {
      return new Response(JSON.stringify({
        manager_team: { id: 'team-castle', name: 'Castle FC', short_name: 'CFC' },
        gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
        players,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (path === '/api/trades') {
      return new Response(JSON.stringify({ trades: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

async function renderPage(locked = false) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const client = new MemoryTeamSelectionClient(locked);
  await act(async () => {
    root.render(<TeamSelectionPage preset={getDefaultThemePreset()} teamSelectionClient={client} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { client, container, root };
}

describe('TeamSelectionPage compatibility export', () => {
  test('renders the canonical Squad workspace without a duplicate panel', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Castle FC squad ready for review.');
    expect(container.textContent).toContain('Next deadline');
    await act(async () => {
      (container.querySelector('button[aria-label="View as list"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(container.querySelector('[aria-label="Starting XI players"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Bench players"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Reserves players"]')).not.toBeNull();
    expect(container.querySelector('.team-selection-panel')).toBeNull();
    expect(container.querySelector('[aria-label="Wildcard, available"]')).not.toBeNull();
  });

  test('persists an available chip through the API client and reports used chips', async () => {
    const { client, container } = await renderPage();
    const wildcardButton = container.querySelector('[aria-label="Wildcard, available"]') as HTMLButtonElement;

    await act(async () => {
      wildcardButton.click();
      await Promise.resolve();
    });

    expect(client.current.chips[0].status).toBe('active');
    expect(container.textContent).toContain('Wildcard chip state updated.');

    await act(async () => {
      (container.querySelector('[aria-label="Bench Boost, used"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Used chips cannot be activated');
  });

  test('shows invalid lineup feedback before sending a save', async () => {
    const { container } = await renderPage();
    await act(async () => {
      (container.querySelector('button[aria-label="View as list"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    const select = container.querySelector('select[aria-label="Move Alex Keeper"]') as HTMLSelectElement;

    await act(async () => {
      select.value = 'bench';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    const saveButton = container.querySelector('button.ui-button') as HTMLButtonElement;
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Invalid lineup');
    expect(container.textContent).toContain('/rules#lineup-validation');
  });

  test('renders a locked lineup with mutation controls disabled', async () => {
    const { container } = await renderPage(true);

    expect(container.textContent).toContain('Lineup locked. FPL deadline passed.');
    await act(async () => {
      (container.querySelector('button[aria-label="View as list"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(Array.from(container.querySelectorAll('select[aria-label^="Move "]')).every((control) => (control as HTMLSelectElement).disabled)).toBe(true);
    expect((container.querySelector('button[aria-label="Wildcard, available"]') as HTMLButtonElement).disabled).toBe(true);
    expect((container.querySelector('button.ui-button') as HTMLButtonElement).disabled).toBe(true);
  });
});
