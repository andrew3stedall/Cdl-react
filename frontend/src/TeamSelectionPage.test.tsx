import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { TeamSelectionPage } from './TeamSelectionPage';
import type {
  TeamSelectionClient,
  TeamSelectionPlayer,
  TeamSelectionSnapshot,
} from './team-selection-api';
import { getDefaultThemePreset } from './theme-presets';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function snapshot(locked = false): TeamSelectionSnapshot {
  return {
    managerTeam: { id: 'team-castle', name: 'Castle FC', shortName: 'CFC' },
    gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
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

async function renderPage(locked = false) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const client = new MemoryTeamSelectionClient(locked);
  await act(async () => {
    root.render(
      <TeamSelectionPage
        preset={getDefaultThemePreset()}
        teamSelectionClient={client}
      />,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return { client, container, root };
}

describe('TeamSelectionPage', () => {
  test('renders API lineup, chips, bench, reserves, and fixture context', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Team selection loaded.');
    expect(container.textContent).toContain('Wildcard');
    expect(container.textContent).toContain('Starters');
    expect(container.textContent).toContain('Bench');
    expect(container.textContent).toContain('Reserves');
    expect(container.textContent).toContain('Castle FC vs Rival Town');
    expect(container.querySelectorAll('.team-selection-player[role="cell"]')).toHaveLength(5);
  });

  test('persists an available chip through the API client and rejects a used chip locally', async () => {
    const { client, container } = await renderPage();
    const wildcardButton = Array.from(container.querySelectorAll('button')).find((button) => {
      return button.parentElement?.textContent?.includes('Wildcard');
    }) as HTMLButtonElement;

    await act(async () => {
      wildcardButton.click();
      await Promise.resolve();
    });

    expect(client.current.chips[0].status).toBe('active');
    expect(container.textContent).toContain('Wildcard chip state updated.');

    const benchBoostButton = Array.from(container.querySelectorAll('button')).find((button) => {
      return button.parentElement?.textContent?.includes('Bench Boost');
    }) as HTMLButtonElement;
    await act(async () => {
      benchBoostButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Used chips cannot be activated');
  });

  test('shows invalid lineup feedback before sending a save', async () => {
    const { container } = await renderPage();
    const select = container.querySelector('select[aria-label="Move Alex Keeper"]') as HTMLSelectElement;

    await act(async () => {
      select.value = 'bench';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save lineup') as HTMLButtonElement;
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Invalid lineup');
    expect(container.textContent).toContain('/rules#lineup-validation');
  });

  test('renders a view-only locked lineup with every mutation control disabled', async () => {
    const { container } = await renderPage(true);

    expect(container.textContent).toContain('Lineup locked. FPL deadline passed.');
    expect(container.textContent).toContain('View-only lineup');
    expect(container.textContent).toContain('Gameweek 1 can no longer be changed.');
    expect(Array.from(container.querySelectorAll('select')).every((control) => control.disabled)).toBe(true);
    expect(Array.from(container.querySelectorAll('button')).every((control) => control.disabled)).toBe(true);
  });
});
