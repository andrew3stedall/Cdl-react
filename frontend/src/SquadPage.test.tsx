import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { SquadPage } from './SquadPage';
import { getDefaultThemePreset } from './theme-presets';
import type {
  TeamSelectionClient,
  TeamSelectionFixtureSummary,
  TeamSelectionSnapshot,
} from './team-selection-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function selectionPlayer(
  id: string,
  name: string,
  position: string,
  slot: 'starter' | 'bench' | 'reserve',
  slotOrder: number,
  captain = false,
  viceCaptain = false,
) {
  return { id, name, position, team: 'ARS', slot, slotOrder, captain, viceCaptain };
}

const fullSelectionSnapshot: TeamSelectionSnapshot = {
  managerTeam: { id: 'team-full', name: 'Full Squad FC', shortName: 'FUL' },
  gameweek: { id: 'gw-full', name: 'Gameweek 1', number: 1, deadlineAt: '2026-08-14T17:30:00Z' },
  players: [
    selectionPlayer('full-gkp-1', 'Starting Keeper', 'GKP', 'starter', 1),
    selectionPlayer('full-def-1', 'Starting Defender 1', 'DEF', 'starter', 2),
    selectionPlayer('full-def-2', 'Starting Defender 2', 'DEF', 'starter', 3),
    selectionPlayer('full-def-3', 'Starting Defender 3', 'DEF', 'starter', 4),
    selectionPlayer('full-mid-1', 'Starting Midfielder 1', 'MID', 'starter', 5, true),
    selectionPlayer('full-mid-2', 'Starting Midfielder 2', 'MID', 'starter', 6, false, true),
    selectionPlayer('full-mid-3', 'Starting Midfielder 3', 'MID', 'starter', 7),
    selectionPlayer('full-mid-4', 'Starting Midfielder 4', 'MID', 'starter', 8),
    selectionPlayer('full-mid-5', 'Starting Midfielder 5', 'MID', 'starter', 9),
    selectionPlayer('full-fwd-1', 'Starting Forward 1', 'FWD', 'starter', 10),
    selectionPlayer('full-fwd-2', 'Starting Forward 2', 'FWD', 'starter', 11),
    selectionPlayer('full-gkp-2', 'Bench Keeper', 'GKP', 'bench', 0),
    selectionPlayer('full-def-4', 'Bench Defender', 'DEF', 'bench', 1),
    selectionPlayer('full-mid-6', 'Bench Midfielder', 'MID', 'bench', 2),
    selectionPlayer('full-fwd-3', 'Bench Forward', 'FWD', 'bench', 3),
    selectionPlayer('full-def-5', 'Bench Defender 2', 'DEF', 'bench', 4),
    selectionPlayer('full-gkp-3', 'Reserve Keeper', 'GKP', 'reserve', 1),
    selectionPlayer('full-mid-7', 'Reserve Midfielder', 'MID', 'reserve', 2),
    selectionPlayer('full-fwd-4', 'Reserve Forward', 'FWD', 'reserve', 3),
    selectionPlayer('full-def-6', 'Reserve Defender', 'DEF', 'reserve', 4),
  ],
  chips: [],
  fixtureLock: { locked: false, fixtureId: null, fixtureType: null, lockScope: null, lockedAt: null, reason: null },
};

class FullTeamSelectionClient implements TeamSelectionClient {
  async getTeamSelection(): Promise<TeamSelectionSnapshot> {
    return fullSelectionSnapshot;
  }

  async getFixtureSummary(): Promise<TeamSelectionFixtureSummary> {
    return { cdlFixtures: [], eplFixtures: [], cdlTable: [], eplTable: [] };
  }

  async saveLineup(players: TeamSelectionSnapshot['players']): Promise<TeamSelectionSnapshot> {
    return { ...fullSelectionSnapshot, players };
  }

  async updateChip(): Promise<TeamSelectionSnapshot> {
    return fullSelectionSnapshot;
  }
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/squad/summary') {
        return new Response(JSON.stringify({
          manager_team: { id: 'team-1', name: 'Exeter Gently', short_name: 'EXE' },
          gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1, deadline_at: '2026-08-14T17:30:00Z' },
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
          gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1, deadline_at: '2026-08-14T17:30:00Z' },
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
              slot: 'starter',
              slot_order: 1,
              is_captain: false,
              is_vice_captain: false,
            },
            {
              id: 'fpl-300',
              display_name: 'Ben Defender',
              position: 'DEF',
              epl_team: { id: 'ars', name: 'Arsenal', short_name: 'ARS' },
              slot: 'starter',
              slot_order: 2,
              is_captain: false,
              is_vice_captain: false,
            },
            {
              id: 'fpl-301',
              display_name: 'Riley Forward',
              position: 'FWD',
              epl_team: { id: 'mci', name: 'Manchester City', short_name: 'MCI' },
              slot: 'bench',
              slot_order: 1,
              is_captain: false,
              is_vice_captain: true,
            },
            {
              id: 'fpl-302',
              display_name: 'Morgan Reserve',
              position: 'MID',
              epl_team: { id: 'ars', name: 'Arsenal', short_name: 'ARS' },
              slot: 'reserve',
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

async function renderPage(teamSelectionClient?: TeamSelectionClient) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SquadPage preset={getDefaultThemePreset()} teamSelectionClient={teamSelectionClient} />);
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
    expect(container.textContent).toContain('Next deadline');
    expect(container.querySelector('[aria-label="Matchweek controls"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Total Points');
    expect(container.querySelector('[aria-label="Squad pitch"]')).not.toBeNull();
    expect(container.querySelector('img[src="/team-shirts/mci.svg"]')).not.toBeNull();
    expect(container.textContent).not.toContain('PostgreSQL');

    await act(async () => {
      (container.querySelector('button[aria-label="View as list"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Starting XI players table"]')).not.toBeNull();
    expect(window.localStorage.getItem('cdl:squad-view')).toBe('list');

    await act(async () => {
      buttonByText(container, 'FWD').click();
      await Promise.resolve();
    });

    const table = container.querySelector('[aria-label="Starting XI players table"]');
    expect(table?.textContent).toContain('Haaland');
    expect(table?.textContent).not.toContain('Pickford');
  });

  test('selects a legal replacement directly from pitch view', async () => {
    const { container } = await renderPage();

    await act(async () => {
      (container.querySelector('button[aria-label="View Haaland details"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      buttonByText(container, 'Substitute player').click();
      await Promise.resolve();
    });

    expect(container.querySelector('.squad-page__drawer')).toBeNull();
    expect(container.querySelector('[aria-label="Substitution mode"]')).not.toBeNull();

    await act(async () => {
      (container.querySelector('button[aria-label="Substitute with Riley Forward"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Bench position for Haaland"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Squad pitch"]')?.textContent).toContain('Riley Forward');
  });

  test('uses the player context menu for legal substitutions and bench ordering', async () => {
    const { container } = await renderPage();

    await act(async () => {
      (container.querySelector('button[aria-label="View as list"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(container.querySelectorAll('.squad-page__list select')).toHaveLength(0);

    await act(async () => {
      (container.querySelector('button[aria-label="Player actions for Haaland"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      buttonByText(container, 'Substitute player').click();
      await Promise.resolve();
    });

    expect(container.querySelector('.squad-page__drawer')).toBeNull();
    expect(container.querySelector('[aria-label="Substitution mode"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Substitute with Riley Forward"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Substitute with Morgan Reserve"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Substitute with Ben Defender"]')).toBeNull();

    await act(async () => {
      (container.querySelector('button[aria-label="Substitute with Riley Forward"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(container.querySelector('[aria-label="Bench position for Haaland"]')).not.toBeNull();

    await act(async () => {
      (container.querySelector('button[aria-label="Bench position 2"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(container.querySelector('button[aria-label="Bench position 2"]')?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      buttonByText(container, 'Confirm substitution').click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Haaland swapped with Riley Forward. Save lineup to apply this change.');
    expect(container.querySelector('[aria-label="Starting XI players table"]')?.textContent).toContain('Riley Forward');
    expect(container.querySelector('[aria-label="Bench players table"]')?.textContent).toContain('Haaland');
  });

  test('filters full-squad substitutions by the Starting XI position rules', async () => {
    const { container } = await renderPage(new FullTeamSelectionClient());

    await act(async () => {
      (container.querySelector('button[aria-label="View as list"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      (container.querySelector('button[aria-label="Player actions for Starting Forward 1"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      buttonByText(container, 'Substitute player').click();
      await Promise.resolve();
    });

    expect(container.querySelector('button[aria-label="Substitute with Bench Defender"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Substitute with Reserve Forward"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Substitute with Bench Keeper"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Substitute with Reserve Keeper"]')).toBeNull();
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
