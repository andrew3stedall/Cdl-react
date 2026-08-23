import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import { earnedDefensiveContributionPoints, PlayerProfilePage, SubstitutionReviewDrawer } from './PlayerProfilePage';
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
    yellow_cards: index === 3 ? 1 : 0,
    red_cards: index === 4 ? 1 : 0,
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

    expect(container.querySelector('.player-profile__player-card')).not.toBeNull();
    expect(container.querySelector('.player-profile__player-card')?.getAttribute('aria-label')).toBe('Shirt for M. Santos');
    expect(container.querySelector('.player-card__shirt-crop .player-card__shirt.large')).not.toBeNull();
    expect(container.querySelector('.player-card__name')?.textContent).toBe('M. Santos');
    expect(container.querySelector('.player-card__opponent')?.textContent).toBe('bha');
    expect(container.querySelector('.player-card__opponent')?.className).toContain('player-card__opponent');
    expect(container.querySelector('.player-card__opponent')?.className).toContain('player-card__opponent--fdr-3');
    expect(container.querySelector('.player-profile__portrait')).toBeNull();
    root.unmount();
  });

  test('keeps the profile on the squad read model gameweek when history has a later fixture', async () => {
    const squadClient = new MemorySquadClient();
    squadClient.getPlayer = async () => ({
      ...player,
      next_fixtures: [{
        fixture_id: 'fixture-arsenal',
        gameweek: { id: 'gw-11', name: 'Gameweek 11', number: 11 },
        opponent: { id: 'epl-ars', name: 'Arsenal', short_name: 'ARS' },
        difficulty: 4,
        is_home: true,
      }],
    });
    squadClient.getPlayerHistory = async () => ({
      ...history,
      fixtures: [{
        fixture_id: 1001,
        gameweek: 12,
        opponent_team_id: BrightonId,
        difficulty: 3,
        is_home: false,
        opponent_name: 'Brighton',
        opponent_short_name: 'BHA',
      }],
    });
    const { container, root } = renderPage(squadClient);
    await settle();

    expect(container.querySelector('.player-card__opponent')?.textContent).toBe('ARS');
    root.unmount();
  });

  test('renders every fixture in the next gameweek for a double gameweek and scopes opponent form to both opponents', async () => {
    const doubleGameweekHistory: SquadApiHistoryResponse = {
      ...history,
      fixtures: [
        { ...history.fixtures[0], gameweek: 11, opponent_team_id: BrightonId },
        {
          ...history.fixtures[0],
          fixture_id: 1000,
          gameweek: 11,
          opponent_team_id: 1001,
          opponent_name: 'Arsenal',
          opponent_short_name: 'ARS',
          is_home: true,
          difficulty: 4,
          opponent_difficulty: 5,
        },
        {
          ...history.fixtures[0],
          fixture_id: 1001,
          gameweek: 12,
          opponent_team_id: 1002,
          opponent_name: 'Liverpool',
          opponent_short_name: 'LIV',
          is_home: false,
        },
      ],
      opponent_defensive_histories: [
        {
          opponent_team_id: BrightonId,
          opponent_name: 'Brighton',
          opponent_short_name: 'BHA',
          fixtures: history.opponent_defensive_history ?? [],
        },
        {
          opponent_team_id: 1001,
          opponent_name: 'Arsenal',
          opponent_short_name: 'ARS',
          fixtures: (history.opponent_defensive_history ?? []).map((fixture) => ({
            ...fixture,
            fixture_id: fixture.fixture_id + 100,
            opponent_short_name: 'MCI',
          })),
        },
      ],
    };
    const squadClient = new MemorySquadClient();
    squadClient.getPlayerHistory = async () => doubleGameweekHistory;
    const { container, root } = renderPage(squadClient);
    await settle();

    expect(container.textContent).not.toContain('Next fixtures');
    expect(container.querySelectorAll('.player-profile__fixture-summary')).toHaveLength(0);
    expect(container.textContent).toContain('bha');
    expect(container.textContent).toContain('ARS');
    expect(container.textContent).not.toContain('liv');
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"]')).toHaveLength(2);
    expect(container.textContent).toContain('Points against Brighton');
    expect(container.textContent).toContain('Points against Arsenal');
    root.unmount();
  });

  test('renders ten chronological fixtures, home/away casing, FDR colours, stat icons, and compact minutes chart', async () => {
    const { container, root } = renderPage();
    await settle();

    expect(container.querySelectorAll('[data-chart-kind="form"] .player-profile__chart-column')).toHaveLength(10);
    expect(container.querySelectorAll('[data-chart-kind="minutes"] .player-profile__chart-column')).toHaveLength(10);
    expect(Array.from(container.querySelectorAll('[data-chart-kind="form"] .player-profile__chart-column')).map((column) => Number((column as HTMLElement).style.gridColumnStart))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect([...container.querySelectorAll('.player-profile__opponent-label')].slice(0, 10).map((node) => node.textContent)).toEqual([
      'WOL', 'bou', 'wol', 'BOU', 'CHE', 'tot', 'AVL', 'ful', 'eve', 'NEW',
    ]);
    expect(container.querySelector('[data-chart-kind="form"]')?.textContent).toContain('—');
    expect(container.querySelector('[data-chart-kind="form"] .player-profile__opponent-label')?.getAttribute('style')).toContain('var(--cdl-fdr-1)');
    expect(container.querySelector('[data-chart-kind="form"]')?.getAttribute('data-y-axis-min')).toBe('0');
    expect(container.querySelector('[data-chart-kind="form"]')?.getAttribute('data-y-axis-max')).toBe('13');
    expect(container.querySelector('[data-chart-kind="form"]')?.getAttribute('aria-label')).toContain('vertical scale 0 to 13 points');
    expect(container.querySelector('[data-chart-kind="form"] .player-profile__stat-icon')?.getAttribute('aria-label')).toContain('Goals scored');
    expect(container.querySelector('[data-chart-kind="form"] .player-profile__stat-icon--yellow')?.getAttribute('aria-label')).toContain('Yellow cards');
    expect(container.querySelector('[data-chart-kind="form"] .player-profile__stat-icon--red')?.getAttribute('aria-label')).toContain('Red cards');
    expect(container.querySelector('[aria-label^="Defensive contributions"]')).toBeNull();
    expect(container.querySelector('.player-profile__stat-multiplier')?.textContent).toBe('×2');
    expect(container.querySelector('.player-profile__stat-multiplier')?.className).toContain('player-profile__stat-multiplier');
    expect(container.querySelector('.player-profile__chart-card--compact')).toBeTruthy();
    expect(container.querySelector('section[aria-labelledby="form"]')?.className).toContain('player-profile__chart-card--compact');
    expect(container.textContent).not.toContain('60 min threshold');
    expect(container.querySelector('.player-profile__threshold-line')).toBeTruthy();
    expect(container.querySelector('[data-chart-kind="minutes"]')?.getAttribute('aria-label')).toBe('Minutes played over the latest ten fixtures');
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__chart-column')).toHaveLength(10);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__grouped-bar--attack')).toHaveLength(10);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__grouped-bar--defence')).toHaveLength(10);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__grouped-bar-value')).toHaveLength(20);
    expect(container.querySelector('[data-chart-kind="opponent-defence"]')?.getAttribute('data-y-axis-min')).toBe('0');
    expect(container.querySelector('[data-chart-kind="opponent-defence"]')?.getAttribute('data-y-axis-max')).toBe('80');
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__bar--stacked')).toHaveLength(0);
    expect(container.textContent).toContain('Attacking assets');
    expect(container.textContent).toContain('Defensive assets');
    expect(container.textContent).not.toContain('last 10 fixtures');
    root.unmount();
  });

  test('right-aligns shorter fixture windows while keeping the newest fixture furthest right', async () => {
    const oneFixtureClient = new MemorySquadClient();
    oneFixtureClient.getPlayerHistory = async () => ({ ...history, history: history.history.slice(-1) });
    const oneFixture = renderPage(oneFixtureClient);
    await settle();
    expect(Array.from(oneFixture.container.querySelectorAll('[data-chart-kind="form"] .player-profile__chart-column')).map((column) => Number((column as HTMLElement).style.gridColumnStart))).toEqual([10]);
    expect(Array.from(oneFixture.container.querySelectorAll('[data-chart-kind="minutes"] .player-profile__chart-column')).map((column) => Number((column as HTMLElement).style.gridColumnStart))).toEqual([10]);
    oneFixture.root.unmount();

    const twoFixtureClient = new MemorySquadClient();
    twoFixtureClient.getPlayerHistory = async () => ({ ...history, history: history.history.slice(-2) });
    const twoFixtures = renderPage(twoFixtureClient);
    await settle();
    expect(Array.from(twoFixtures.container.querySelectorAll('[data-chart-kind="form"] .player-profile__chart-column')).map((column) => Number((column as HTMLElement).style.gridColumnStart))).toEqual([9, 10]);
    expect([...twoFixtures.container.querySelectorAll('[data-chart-kind="form"] .player-profile__opponent-label')].map((node) => node.textContent)).toEqual(['eve', 'NEW']);
    twoFixtures.root.unmount();
  });

  test('keeps the form chart scale at a minimum of ten points', async () => {
    const lowScoringHistory: SquadApiHistoryResponse = {
      ...history,
      history: history.history.map((row) => ({ ...row, total_points: Math.min(row.total_points, 9) })),
    };
    const squadClient = new MemorySquadClient();
    squadClient.getPlayerHistory = async () => lowScoringHistory;
    const { container, root } = renderPage(squadClient);
    await settle();

    expect(container.querySelector('[data-chart-kind="form"]')?.getAttribute('data-y-axis-min')).toBe('0');
    expect(container.querySelector('[data-chart-kind="form"]')?.getAttribute('data-y-axis-max')).toBe('10');
    expect(container.querySelector('[data-chart-kind="form"]')?.getAttribute('aria-label')).toContain('vertical scale 0 to 10 points');
    root.unmount();
  });

  test('only treats defensive contributions as a scoring return at the FPL position threshold', () => {
    expect(earnedDefensiveContributionPoints(9, 'DEF')).toBe(false);
    expect(earnedDefensiveContributionPoints(10, 'DEF')).toBe(true);
    expect(earnedDefensiveContributionPoints(11, 'MID')).toBe(false);
    expect(earnedDefensiveContributionPoints(12, 'MID')).toBe(true);
    expect(earnedDefensiveContributionPoints(12, 'FWD')).toBe(true);
    expect(earnedDefensiveContributionPoints(12, 'GKP')).toBe(false);
  });

  test('renders the substitution review as two player columns with only the latest four fixtures', async () => {
    const squadClient = new MemorySquadClient();
    const target = { ...player, id: 'fpl-51', display_name: 'Replacement Player' };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    act(() => {
      root.render(
        <ThemePresetProvider initialPresetName="teal-dark" preferenceClient={preferenceClient}>
          <SubstitutionReviewDrawer
            onCancel={() => undefined}
            onConfirm={() => undefined}
            sourcePlayer={player}
            squadClient={squadClient}
            targetPlayer={target}
          />
        </ThemePresetProvider>,
      );
    });
    await settle();

    expect(container.querySelectorAll('.player-profile__comparison-player')).toHaveLength(2);
    expect(container.querySelectorAll('[data-chart-kind="form"] .player-profile__chart-column')).toHaveLength(8);
    expect(container.querySelectorAll('[data-chart-kind="minutes"] .player-profile__chart-column')).toHaveLength(8);
    expect(Array.from(container.querySelectorAll('[data-chart-kind="form"], [data-chart-kind="minutes"]')).every((chart) => chart.getAttribute('aria-label')?.includes('latest four'))).toBe(true);
    root.unmount();
  });

  test('renders captaincy and availability tags from current data', async () => {
    const doubtful = { ...player, availability_status: 'doubtful', availability_news: 'Late fitness test', chance_of_playing_next_round: 75 };
    const squadClient = new MemorySquadClient();
    squadClient.getPlayer = async () => doubtful;
    const { container, root } = renderPage(squadClient);
    await settle();
    expect(container.textContent).toContain('Doubtful');
    expect(container.querySelector('.player-profile__availability-news')?.textContent).toContain('Late fitness test');
    expect(container.querySelector('.player-profile__availability-news')?.textContent).toContain('Chance 75%');
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

    const captainButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Captain');
    expect(captainButton).toBeTruthy();
    act(() => { captainButton?.click(); });
    await settle();
    expect(teamSelectionClient.saved.at(-1)?.find((candidate) => candidate.id === player.id)?.captain).toBe(true);
    expect(teamSelectionClient.saved.at(-1)?.find((candidate) => candidate.id === 'fpl-11')?.captain).toBe(false);
    expect(teamSelectionClient.saved.at(-1)?.find((candidate) => candidate.id === 'fpl-11')?.viceCaptain).toBe(false);
    expect(teamSelectionClient.saved.at(-1)?.find((candidate) => candidate.id === 'fpl-12')?.viceCaptain).toBe(true);
    root.unmount();

    const viceSelectionClient = new MemoryTeamSelectionClient();
    const { container: viceContainer, root: viceRoot } = renderPage(new MemorySquadClient(), viceSelectionClient);
    await settle();
    const viceButton = [...viceContainer.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Vice');
    expect(viceButton).toBeTruthy();
    act(() => { viceButton?.click(); });
    await settle();
    expect(viceSelectionClient.saved.at(-1)?.find((candidate) => candidate.id === player.id)?.viceCaptain).toBe(true);
    expect(viceSelectionClient.saved.at(-1)?.find((candidate) => candidate.id === 'fpl-11')?.captain).toBe(true);
    expect(viceSelectionClient.saved.at(-1)?.find((candidate) => candidate.id === 'fpl-12')?.viceCaptain).toBe(false);
    viceRoot.unmount();

    const benchSelectionClient = new MemoryTeamSelectionClient();
    const { container: benchContainer, root: benchRoot } = renderPage(new MemorySquadClient(), benchSelectionClient);
    await settle();
    const benchButton = [...benchContainer.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Sub');
    expect(benchButton).toBeTruthy();
    act(() => { benchButton?.click(); });
    await settle();
    expect(benchContainer.textContent).toContain('Choose substitution');
    const benchOption = [...benchContainer.querySelectorAll('button')].find((button) => button.textContent?.includes('Bench Player'));
    expect(benchOption).toBeTruthy();
    act(() => { benchOption?.click(); });
    const confirmButton = [...benchContainer.querySelectorAll('button')].find((button) => button.textContent?.includes('Confirm sub'));
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
