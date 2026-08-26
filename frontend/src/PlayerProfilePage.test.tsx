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
    saves: index === 4 ? 3 : 0,
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
    stat_icons: index === 2 ? {
      goals: 1,
      assists: 2,
      clean_sheets: 0,
      saves: 3,
      yellow_cards: 0,
      red_cards: 0,
      defensive_contributions: 0,
      bonus_points: 0,
    } : undefined,
    stat_details: index === 2 ? [
      { category: 'goals', player_name: 'Saka', value: 1, points: 5 },
      { category: 'goals', player_name: 'Haaland', value: 2, points: 10 },
      { category: 'assists', player_name: 'Ødegaard', value: 1, points: 3 },
      { category: 'clean_sheets', player_name: 'Saka', value: 1, points: 1 },
      { category: 'defensive_contributions', player_name: 'Saliba', value: 10, points: 2 },
      { category: 'bonus_points', player_name: 'Saka', value: 3, points: 3 },
      { category: 'yellow_cards', player_name: 'Saka', value: 1, points: -1 },
      { category: 'red_cards', player_name: 'Saka', value: 1, points: -3 },
      { category: 'own_goals', player_name: 'Saka', value: 1, points: -2 },
    ] : undefined,
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

function renderPage(
  squadClient = new MemorySquadClient(),
  teamSelectionClient = new MemoryTeamSelectionClient(),
  presentation: 'page' | 'drawer' = 'page',
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(
      <ThemePresetProvider initialPresetName="teal-dark" preferenceClient={preferenceClient}>
        <PlayerProfilePage
          playerId={player.id}
          presentation={presentation}
          squadClient={squadClient}
          teamSelectionClient={teamSelectionClient}
        />
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
  test('uses the shared player card in the drawer header', async () => {
    const { container, root } = renderPage();
    await settle();

    expect(container.querySelector('.player-profile__header-player-card')).not.toBeNull();
    expect(container.querySelector('.player-profile__header-player-card')?.getAttribute('aria-label')).toBe('Player card for M. Santos');
    expect(container.querySelector('.player-card__shirt-crop .player-card__shirt.large')).not.toBeNull();
    expect(container.querySelector('.player-card__name')?.textContent).toBe('M. Santos');
    expect(container.querySelector('.player-card__opponent')?.textContent).toBe('bha');
    expect(container.querySelector('.player-card__opponent')?.className).toContain('player-card__opponent');
    expect(container.querySelector('.player-card__opponent')?.className).toContain('player-card__opponent--fdr-3');
    expect(container.querySelector('.player-profile__portrait')).toBeNull();
    expect(container.querySelector('.player-profile__identity-card')).toBeNull();
    expect(container.querySelector('.player-profile__favourite')).toBeNull();
    root.unmount();
  });

  test('adds a reachable scroll tail when the profile is presented as a drawer', async () => {
    const { container, root } = renderPage(new MemorySquadClient(), new MemoryTeamSelectionClient(), 'drawer');
    await settle();

    expect(container.querySelector('.player-profile--drawer .player-profile__scroll-end-spacer')).not.toBeNull();
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
    expect(container.querySelectorAll('.player-profile__opponent-chart-heading')).toHaveLength(2);
    expect(container.textContent).toContain('Points againstbha');
    expect(container.textContent).toContain('Points againstARS');
    root.unmount();
  });

  test('renders the latest eight chronological fixtures in one combined form and minutes chart', async () => {
    const { container, root } = renderPage();
    await settle();

    expect(container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-chart-column')).toHaveLength(8);
    expect([...container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-opponent')].map((node) => node.textContent)).toEqual([
      'wol', 'BOU', 'CHE', 'tot', 'AVL', 'ful', 'eve', 'NEW',
    ]);
    const firstFixtureOpponent = [...container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-opponent')].find((node) => node.textContent);
    expect(firstFixtureOpponent?.getAttribute('style')).toContain('var(--cdl-fdr-3)');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"]')?.getAttribute('data-y-axis-min')).toBe('-90');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"]')?.getAttribute('data-y-axis-max')).toBe('15');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"]')?.getAttribute('data-y-axis-tick-step')).toBe('5');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"]')?.getAttribute('data-minutes-y-axis-max')).toBe('90');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"]')?.getAttribute('data-minutes-y-axis-tick-step')).toBe('30');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"]')?.getAttribute('data-minutes-y-axis-threshold')).toBe('60');
    expect(container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-threshold-line')).toHaveLength(8);
    expect(container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-chart-grid--positive .player-profile__chart-gridline')).toHaveLength(2);
    expect(container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-chart-grid--negative .player-profile__chart-gridline')).toHaveLength(2);
    expect(container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__chart-zero-line')).toHaveLength(2);
    expect(container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__chart-y-axis-scale')).toHaveLength(2);
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"] .player-profile__combined-chart-y-axis-scale--positive')?.getAttribute('data-axis-direction')).toBe('up');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"] .player-profile__combined-chart-y-axis-scale--negative')?.getAttribute('data-axis-direction')).toBe('down');
    expect([...container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__chart-y-axis-label')].map((node) => node.textContent)).toEqual([
      '15', '10', '5', '0', '90', '60', '30', '0',
    ]);
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"] .player-profile__combined-chart-grid--negative .player-profile__chart-gridline')?.getAttribute('style')).toContain('top: 33.33333333333333%');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"]')?.getAttribute('aria-label')).toContain('Fantasy points above the zero line and minutes played below it');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"] .player-profile__stat-icon')?.getAttribute('aria-label')).toContain('Goals scored');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"] [data-stat-key="assists"] svg')).toBeTruthy();
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"] [data-stat-key="clean-sheets"] svg')).toBeTruthy();
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"] [data-stat-key="saves"] svg')).toBeTruthy();
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"] .player-profile__stat-icon--yellow')?.getAttribute('aria-label')).toContain('Yellow cards');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"] .player-profile__stat-icon--red')?.getAttribute('aria-label')).toContain('Red cards');
    expect(container.querySelector('[aria-label^="Defensive contributions"]')).toBeNull();
    expect(container.querySelector('.player-profile__stat-multiplier')?.textContent).toBe('×2');
    expect(container.querySelector('.player-profile__stat-multiplier')?.className).toContain('player-profile__stat-multiplier');
    expect(container.querySelector('.player-profile__chart-card--compact')).toBeTruthy();
    expect(container.textContent).not.toContain('60 min threshold');
    expect(container.querySelector('.player-profile__threshold-line')).toBeNull();
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__chart-column')).toHaveLength(8);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__grouped-bar--attack')).toHaveLength(8);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__grouped-bar--defence')).toHaveLength(8);
    expect([...container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__grouped-bar-point-label')].map((node) => node.textContent)).toEqual(
      Array.from({ length: 8 }, (_, index) => [String(index + 4), '2']).flat(),
    );
    expect(container.querySelector('[data-chart-kind="opponent-defence"] .player-profile__grouped-bar-point-label--attack')).toBeTruthy();
    expect(container.querySelector('[data-chart-kind="opponent-defence"] .player-profile__grouped-bar-point-label--defence')).toBeTruthy();
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__grouped-bar-value')).toHaveLength(0);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__grouped-stat-icons .player-profile__stat-icon')).toHaveLength(3);
    expect(container.querySelector('[data-chart-kind="opponent-defence"]')?.getAttribute('data-y-axis-min')).toBe('0');
    expect(container.querySelector('[data-chart-kind="opponent-defence"]')?.getAttribute('data-y-axis-max')).toBe('80');
    expect(container.querySelector('[data-chart-kind="opponent-defence"]')?.getAttribute('data-y-axis-tick-step')).toBe('10');
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__chart-gridline')).toHaveLength(7);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__chart-zero-line')).toHaveLength(1);
    expect([...container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__chart-y-axis-label')].map((node) => node.textContent)).toEqual([
      '80', '70', '60', '50', '40', '30', '20', '10', '0',
    ]);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__bar--stacked')).toHaveLength(0);
    expect(container.textContent).toContain('Attacking assets');
    expect(container.textContent).toContain('Defensive assets');
    expect(container.textContent).not.toContain('last 10 fixtures');
    root.unmount();
  });

  test('renders empty slots before shorter fixture windows while keeping the newest fixture furthest right', async () => {
    const oneFixtureClient = new MemorySquadClient();
    oneFixtureClient.getPlayerHistory = async () => ({ ...history, history: history.history.slice(-1), opponent_defensive_history: history.opponent_defensive_history?.slice(-1) });
    const oneFixture = renderPage(oneFixtureClient);
    await settle();
    expect(oneFixture.container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-chart-column')).toHaveLength(8);
    expect(oneFixture.container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-bar--empty')).toHaveLength(14);
    expect(oneFixture.container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__grouped-bar-empty')).toHaveLength(7);
    expect([...oneFixture.container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-opponent')].map((node) => node.textContent)).toEqual(['', '', '', '', '', '', '', 'NEW']);
    oneFixture.root.unmount();

    const twoFixtureClient = new MemorySquadClient();
    twoFixtureClient.getPlayerHistory = async () => ({ ...history, history: history.history.slice(-2) });
    const twoFixtures = renderPage(twoFixtureClient);
    await settle();
    expect(twoFixtures.container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-chart-column')).toHaveLength(8);
    expect(twoFixtures.container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-bar--empty')).toHaveLength(12);
    expect([...twoFixtures.container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-opponent')].map((node) => node.textContent)).toEqual(['', '', '', '', '', '', 'eve', 'NEW']);
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

    expect(container.querySelector('[data-chart-kind="combined-form-minutes"]')?.getAttribute('data-y-axis-max')).toBe('10');
    expect(container.querySelector('[data-chart-kind="combined-form-minutes"]')?.getAttribute('aria-label')).toContain('Fantasy points above the zero line');
    root.unmount();
  });

  test('opens reusable fixture details from form and opposition bars', async () => {
    const { container, root } = renderPage();
    await settle();

    const formBar = Array.from(container.querySelectorAll('button[aria-label*="form details"]'))
      .find((button) => button.getAttribute('aria-label')?.includes('CHE'));
    expect(formBar).toBeTruthy();
    act(() => {
      formBar?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('[data-chart-detail-kind="form"]')).toBeTruthy();
    expect(container.textContent).toContain('Scoring returns');
    expect(container.textContent).toContain('Goals');
    expect(container.textContent).toContain('Minutes90+2');
    expect(container.textContent).toContain('Goals2+8');
    expect(container.textContent).toContain('Red card1-3');

    act(() => {
      container.querySelector('.player-chart-detail-backdrop')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('[data-chart-detail-kind="form"]')).toBeNull();

    const opponentBar = container.querySelector('button[aria-label*="points-against details"]');
    expect(opponentBar).toBeTruthy();
    act(() => {
      opponentBar?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('[data-chart-detail-kind="opponent"]')).toBeTruthy();
    expect(container.textContent).toContain('Saka');
    expect(container.textContent).toContain('+5');
    expect([...container.querySelectorAll('[data-chart-detail-kind="opponent"] .player-chart-detail__section h3')].map((heading) => heading.textContent)).toEqual([
      'Goals',
      'Assists',
      'Clean sheets',
      'Defensive contributions',
      'Bonus points',
      'Yellow cards',
      'Red cards',
      'Own goals',
    ]);
    expect([...container.querySelectorAll('[data-chart-detail-kind="opponent"] .player-chart-detail__section:first-of-type li span')].map((row) => row.textContent)).toEqual(['Haaland', 'Saka']);
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

  test('renders the substitution review as two player columns with only the latest five fixtures', async () => {
    const squadClient = new MemorySquadClient();
    const target = {
      ...player,
      id: 'fpl-51',
      display_name: 'Replacement Player',
      next_fixture: {
        fixture_id: 'fixture-replacement',
        opponent: { id: 'epl-bha', name: 'Brighton', short_name: 'BHA' },
        difficulty: history.fixtures[0].difficulty,
        is_home: history.fixtures[0].is_home,
      },
    };
    const source = {
      ...player,
      next_fixture: {
        fixture_id: 'fixture-source',
        opponent: { id: 'epl-bha', name: 'Brighton', short_name: 'BHA' },
        difficulty: history.fixtures[0].difficulty,
        is_home: history.fixtures[0].is_home,
      },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    act(() => {
      root.render(
        <ThemePresetProvider initialPresetName="teal-dark" preferenceClient={preferenceClient}>
          <SubstitutionReviewDrawer
            onCancel={() => undefined}
            onConfirm={() => undefined}
            sourcePlayer={source}
            squadClient={squadClient}
            targetPlayer={target}
          />
        </ThemePresetProvider>,
      );
    });
    await settle();

    expect(container.querySelectorAll('.player-profile__comparison-player')).toHaveLength(2);
    expect(container.querySelectorAll('.player-profile__comparison-player .player-card')).toHaveLength(2);
    expect(container.querySelectorAll('.player-profile__comparison-player .player-card__opponents')).toHaveLength(2);
    expect(container.querySelectorAll('.player-profile__comparison-identity h3')).toHaveLength(0);
    expect(container.querySelector('.player-profile__comparison-heading')).toBeNull();
    expect(container.querySelectorAll('.player-profile__comparison-player-heading')).toHaveLength(0);
    expect(container.textContent).not.toContain('↔');
    expect(container.textContent).not.toContain('Next:');
    expect(container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-chart-column')).toHaveLength(10);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__chart-column')).toHaveLength(10);
    expect(container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__combined-chart-y-axis-scale--positive, [data-chart-kind="combined-form-minutes"] .player-profile__combined-chart-y-axis-scale--negative')).toHaveLength(4);
    expect(container.querySelectorAll('[data-chart-kind="combined-form-minutes"] .player-profile__chart-gridline')).toHaveLength(6);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__chart-y-axis')).toHaveLength(2);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__chart-gridline')).toHaveLength(14);
    expect(container.querySelectorAll('[data-chart-kind="opponent-defence"] .player-profile__chart-zero-line')).toHaveLength(2);
    expect(Array.from(container.querySelectorAll('[data-chart-kind="combined-form-minutes"], [data-chart-kind="opponent-defence"]')).every((chart) => chart.getAttribute('data-fixture-count') === '5')).toBe(true);
    expect(Array.from(container.querySelectorAll('[data-chart-kind="combined-form-minutes"]')).every((chart) => chart.getAttribute('aria-label')?.includes('latest five'))).toBe(true);
    root.unmount();
  });

  test('renders captaincy and availability tags from current data', async () => {
    const doubtful = { ...player, availability_status: 'doubtful', availability_news: 'Late fitness test', chance_of_playing_next_round: 75 };
    const squadClient = new MemorySquadClient();
    squadClient.getPlayer = async () => doubtful;
    const { container, root } = renderPage(squadClient);
    await settle();
    expect(container.querySelector('.player-profile__header-player-card .player-card__availability')?.getAttribute('aria-label')).toContain('75% chance of playing');
    expect(container.querySelector('.player-profile__availability-news')?.textContent).toContain('Late fitness test');
    expect(container.querySelector('.player-profile__availability-news')?.textContent).toContain('Chance 75%');
    root.unmount();

    const injured = { ...player, availability_status: 'injured', chance_of_playing_next_round: 25 };
    const injuredClient = new MemorySquadClient();
    injuredClient.getPlayer = async () => injured;
    const { container: injuredContainer, root: injuredRoot } = renderPage(injuredClient);
    await settle();
    expect(injuredContainer.querySelector('.player-profile__header-player-card .player-card__availability')?.getAttribute('aria-label')).toContain('25% chance of playing');
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
    expect(container.querySelector('.player-profile__header-player-card .player-card__role')?.textContent).toBe('C');
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
    expect(viceContainer.querySelector('.player-profile__header-player-card .player-card__role')?.textContent).toBe('VC');
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
    expect(benchContainer.querySelectorAll('.player-profile__action-option .player-card').length).toBeGreaterThan(0);
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
