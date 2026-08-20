import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import { PlayerProfilePage } from './PlayerProfilePage';
import type {
  SquadApiHistoryResponse,
  SquadApiPlayer,
  SquadApiSummary,
  SquadClient,
} from './squad-api';
import type { PreferenceClient } from './preferences-api';
import { ThemePresetProvider } from './theme-preset-provider';
import type { UserPreferences } from './contracts';
import type {
  TeamSelectionClient,
  TeamSelectionFixtureSummary,
  TeamSelectionPlayer,
  TeamSelectionSnapshot,
} from './team-selection-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const player: SquadApiPlayer = {
  id: 'fpl-10',
  display_name: 'M. Santos',
  position: 'FWD',
  epl_team: { id: 'epl-nfc', name: 'Northcastle FC', short_name: 'NFC' },
  status: 'owned',
  points: 82,
  form: 7.3,
  value: 9.5,
  selected_by_percent: 21,
  availability_status: 'a',
  chance_of_playing_next_round: null,
  next_fixture: null,
};

const BrightonId = 999;

const historyFixtures: Array<[string, boolean, number, number]> = [
  ['WOL', true, 0, 0],
  ['BOU', false, 0, 0],
  ['WOL', false, 90, 9],
  ['BOU', true, 55, 2],
  ['CHE', true, 90, 13],
  ['TOT', false, 84, 8],
  ['AVL', true, 60, 5],
  ['FUL', false, 24, 3],
  ['EVE', false, 90, 10],
  ['NEW', true, 76, 7],
];

const history: SquadApiHistoryResponse = {
  player_id: player.id,
  fetched_at: '2026-08-20T12:00:00Z',
  response_sha256: 'history-sha',
  history: historyFixtures.map(([opponent, wasHome, minutes, points], index) => ({
    gameweek: index + 1,
    fixture_id: index + 100,
    opponent_team_id: index + 200,
    total_points: points,
    minutes,
    goals_scored: index === 4 ? 2 : index === 2 ? 1 : 0,
    assists: index === 3 ? 1 : 0,
    clean_sheets: index === 2 ? 1 : 0,
    bonus: index === 4 ? 2 : 0,
    bps: 30,
    expected_goals: 0.4,
    expected_assists: 0.2,
    value: 95,
    was_home: wasHome,
    kickoff_time: `2026-08-${String(index + 1).padStart(2, '0')}T14:00:00Z`,
    opponent_short_name: opponent,
    difficulty: (index % 5) + 1,
    defensive_contributions: index === 4 ? 3 : 0,
  })),
  fixtures: [{
    fixture_id: 999,
    gameweek: 11,
    opponent_team_id:  BrightonId,
    difficulty: 3,
    is_home: false,
    opponent_short_name: 'BHA',
    opponent_name: 'Brighton',
    opponent_difficulty: 2,
  }],
  opponent_defensive_history: Array.from({ length: 10 }, (_, index) => ({
    fixture_id: index + 300,
    gameweek: index + 1,
    opponent_short_name: ['ARS', 'CHE', 'LIV', 'MCI', 'WHU', 'EVE', 'FUL', 'AVL', 'TOT', 'NEW'][index],
    is_home: index % 2 === 0,
    difficulty: (index % 5) + 1,
    total_points_conceded: 4 + index,
    attacking_asset_points: 2 + index,
    defensive_asset_points: 2,
  })),
};

function selectionPlayers(): TeamSelectionPlayer[] {
  return [
    { id: player.id, name: player.display_name, position: player.position, team: 'NFC', slot: 'starter', slotOrder: 1, captain: false, viceCaptain: false },
    { id: 'fpl-11', name: 'Captain Player', position: 'MID', team: 'ARS', slot: 'starter', slotOrder: 2, captain: true, viceCaptain: false },
    { id: 'fpl-12', name: 'Vice Player', position: 'DEF', team: 'CHE', slot: 'starter', slotOrder: 3, captain: false, viceCaptain: true },
    { id: 'fpl-13', name: 'Bench Player', position: 'FWD', team: 'MCI', slot: 'bench', slotOrder: 1, captain: false, viceCaptain: false },
    { id: 'fpl-14', name: 'Reserve Player', position: 'GKP', team: 'EVE', slot: 'reserve', slotOrder: 1, captain: false, viceCaptain: false },
  ];
}

const initialSelection: TeamSelectionSnapshot = {
  managerTeam: { id: 'manager-team', name: 'Castle Draft', shortName: 'CAS' },
  gameweek: { id: 'gw-11', name: 'Gameweek 11', number: 11 },
  players: selectionPlayers(),
  chips: [],
  fixtureLock: { locked: false, fixtureId: null, fixtureType: null, lockScope: null, lockedAt: null, reason: null },
};

class MemoryTeamSelectionClient implements TeamSelectionClient {
  current = initialSelection;
  saved: TeamSelectionPlayer[][] = [];

  async getTeamSelection() { return this.current; }
  async getFixtureSummary(): Promise<TeamSelectionFixtureSummary> { return { cdlFixtures: [], eplFixtures: [], cdlTable: [], eplTable: [] }; }
  async saveLineup(players: TeamSelectionPlayer[]) {
    this.saved.push(players);
    this.current = { ...this.current, players };
    return this.current;
  }
  async updateChip() { return this.current; }
}

class MemorySquadClient implements SquadClient {
  changesApplied: string[][] = [];

  async getWorkspace() { return { summary: this.summary(), notifications: { notifications: [], proposed_trade_count: 0 } }; }
  async getSummary() { return this.summary(); }
  async getScoutingPlayers() { return { players: [player] }; }
  async getTrades() { return { trades: [] }; }
  async getChanges() { return { available_to_add: [replacementPlayer] }; }
  async getNotifications() { return { notifications: [], proposed_trade_count: 0 }; }
  async getPlayer() { return player; }
  async getPlayerHistory() { return history; }
  async createTrade() { return { id: 'trade-1', status: 'proposed' }; }
  async applyChanges(addPlayerIds: string[], removePlayerIds: string[]) {
    this.changesApplied.push([...addPlayerIds, ...removePlayerIds]);
    return this.summary();
  }

  private summary(): SquadApiSummary {
    return { manager_team: player.epl_team, gameweek: { id: 'gw-11', name: 'Gameweek 11', number: 11 }, players: [player] };
  }
}

const replacementPlayer: SquadApiPlayer = {
  ...player,
  id: 'fpl-50',
  display_name: 'Replacement Player',
  status: 'available',
};

const preferenceClient: PreferenceClient = {
  getPreferences: async (): Promise<UserPreferences> => ({
    themePreset: 'teal-dark' as const,
    attackDirection: 'up' as const,
    fdrScale: 'RdYlGn' as const,
    fdrScaleReversed: false,
    fdrDisplayMode: 'font' as const,
  }),
  updatePreferences: async (preferences: UserPreferences) => preferences,
};

function renderPage(squadClient = new MemorySquadClient(), teamSelectionClient = new MemoryTeamSelectionClient()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(
      <ThemePresetProvider initialPresetName="teal-dark" preferenceClient={preferenceClient}>
        <PlayerProfilePage playerId={player.id} squadClient={squadClient} teamSelectionClient={teamSelectionClient} />
      </ThemePresetProvider>,
    );
  });
  return { container, root, squadClient, teamSelectionClient };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('PlayerProfilePage', () => {
  test('uses the squad shirt token treatment instead of an initials portrait', async () => {
    const { container, root } = renderPage();
    await settle();

    expect(container.querySelector('.player-profile__shirt-token')).not.toBeNull();
    expect(container.querySelector('.player-profile__shirt-token')?.getAttribute('aria-label')).toBe('Shirt for M. Santos');
    expect(container.querySelector('.player-profile__shirt-crop .squad-page__shirt.large')).not.toBeNull();
    expect(container.querySelector('.player-profile__shirt-name')?.textContent).toBe('M. Santos');
    expect(container.querySelector('.player-profile__portrait')).toBeNull();
    root.unmount();
  });

  test('renders ten chronological fixtures, home/away casing, FDR colours, stat icons, and compact minutes chart', async () => {
    const { container, root } = renderPage();
    await settle();

    expect(container.querySelectorAll('[data-chart-kind="form"] .player-profile__chart-column')).toHaveLength(10);
    expect(container.querySelectorAll('[data-chart-kind="minutes"] .player-profile__chart-column')).toHaveLength(10);
    expect([...container.querySelectorAll('.player-profile__opponent-label')].slice(0, 10).map((node) => node.textContent)).toEqual([
      'WOL', 'bou', 'wol', 'BOU', 'CHE', 'tot', 'AVL', 'ful', 'eve', 'NEW',
    ]);
    expect(container.querySelector('[data-chart-kind="form"]')?.textContent).toContain('—');
    expect(container.querySelector('[data-chart-kind="form"] .player-profile__opponent-label')?.getAttribute('style')).toContain('var(--cdl-fdr-1)');
    expect(container.querySelector('[data-chart-kind="form"] .player-profile__stat-icon')?.getAttribute('aria-label')).toContain('Goals scored');
    expect(container.querySelector('.player-profile__stat-multiplier')?.textContent).toBe('×2');
    expect(container.querySelector('.player-profile__stat-multiplier')?.className).toContain('player-profile__stat-multiplier');
    expect(container.querySelector('.player-profile__chart-card--compact')).toBeTruthy();
    expect(container.textContent).not.toContain('60 min threshold');
    expect(container.querySelector('.player-profile__threshold-line')).toBeTruthy();
    expect(container.querySelector('[data-chart-kind="minutes"]')?.getAttribute('aria-label')).toBe('Minutes played over the latest ten fixtures');
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__chart-column')).toHaveLength(10);
    expect(container.textContent).toContain('Attacking assets');
    expect(container.textContent).toContain('Defensive assets');
    root.unmount();
  });

  test('renders captaincy and availability tags from current data', async () => {
    const doubtful = { ...player, availability_status: 'doubtful', chance_of_playing_next_round: 75 };
    const squadClient = new MemorySquadClient();
    squadClient.getPlayer = async () => doubtful;
    const { container, root } = renderPage(squadClient);
    await settle();
    expect(container.textContent).toContain('Doubtful');
    expect(container.textContent).not.toContain('Injured');
    root.unmount();

    const injured = { ...player, availability_status: 'injured', chance_of_playing_next_round: 25 };
    const injuredClient = new MemorySquadClient();
    injuredClient.getPlayer = async () => injured;
    const { container: injuredContainer, root: injuredRoot } = renderPage(injuredClient);
    await settle();
    expect(injuredContainer.textContent).toContain('Injured');
    injuredRoot.unmount();
  });

  test('updates the real lineup when captaincy changes or the player moves to the bench', async () => {
    const teamSelectionClient = new MemoryTeamSelectionClient();
    const { container, root } = renderPage(new MemorySquadClient(), teamSelectionClient);
    await settle();

    const captainButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Make captain'));
    expect(captainButton).toBeTruthy();
    act(() => { captainButton?.click(); });
    await settle();
    expect(teamSelectionClient.saved.at(-1)?.find((candidate) => candidate.id === player.id)?.captain).toBe(true);
    root.unmount();

    const benchSelectionClient = new MemoryTeamSelectionClient();
    const { container: benchContainer, root: benchRoot } = renderPage(new MemorySquadClient(), benchSelectionClient);
    await settle();
    const benchButton = [...benchContainer.querySelectorAll('button')].find((button) => button.textContent?.includes('Move to bench'));
    expect(benchButton).toBeTruthy();
    act(() => { benchButton?.click(); });
    await settle();
    expect(benchContainer.textContent).toContain('Move to bench');
    const benchOption = [...benchContainer.querySelectorAll('button')].find((button) => button.textContent?.includes('Bench Player'));
    expect(benchOption).toBeTruthy();
    act(() => { benchOption?.click(); });
    const confirmButton = [...benchContainer.querySelectorAll('button')].find((button) => button.textContent?.includes('Confirm move'));
    expect(confirmButton).toBeTruthy();
    act(() => { confirmButton?.click(); });
    await settle();
    expect(benchSelectionClient.saved.at(-1)?.find((candidate) => candidate.id === player.id)?.slot).toBe('bench');
    benchRoot.unmount();
  });

  test('confirms a destructive remove action through the existing squad mutation', async () => {
    const squadClient = new MemorySquadClient();
    const { container, root } = renderPage(squadClient);
    await settle();
    const removeButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Remove');
    expect(removeButton).toBeTruthy();
    act(() => { removeButton?.click(); });
    await settle();
    const replacement = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Replacement Player'));
    expect(replacement).toBeTruthy();
    act(() => { replacement?.click(); });
    const confirm = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Confirm removal'));
    expect(confirm).toBeTruthy();
    act(() => { confirm?.click(); });
    await settle();
    expect(squadClient.changesApplied).toEqual([[replacementPlayer.id, player.id]]);
    root.unmount();
  });
});
