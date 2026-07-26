import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { App } from './App';
import type { SessionState, UserPreferences } from './contracts';
import type { PreferenceClient } from './preferences-api';
import type { TeamSelectionClient, TeamSelectionSnapshot } from './team-selection-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const authenticatedSession: SessionState = {
  isAuthenticated: true,
  user: {
    id: 'test-manager',
    email: 'manager@example.com',
    displayName: 'CDL Manager',
    roles: ['manager'],
  },
  expiresAt: null,
};

const teamSelectionSnapshot: TeamSelectionSnapshot = {
  managerTeam: { id: 'team-castle', name: 'Castle FC' },
  gameweek: { id: 'gw-1', name: 'Gameweek 1', number: 1 },
  players: [
    { id: 'player-1', name: 'Alex Keeper', position: 'GKP', team: 'ARS', slot: 'starter', slotOrder: 1, captain: false, viceCaptain: false },
    { id: 'player-2', name: 'Ben Defender', position: 'DEF', team: 'MCI', slot: 'starter', slotOrder: 2, captain: false, viceCaptain: false },
    { id: 'player-3', name: 'Casey Midfielder', position: 'MID', team: 'ARS', slot: 'starter', slotOrder: 3, captain: true, viceCaptain: false },
    { id: 'player-4', name: 'Riley Forward', position: 'FWD', team: 'MCI', slot: 'bench', slotOrder: 1, captain: false, viceCaptain: true },
    { id: 'player-5', name: 'Morgan Reserve', position: 'MID', team: 'ARS', slot: 'reserve', slotOrder: 1, captain: false, viceCaptain: false },
  ],
  chips: [],
  fixtureLock: { locked: false, fixtureId: null, fixtureType: null, lockScope: null, lockedAt: null, reason: null },
};

class MemoryTeamSelectionClient implements TeamSelectionClient {
  async getTeamSelection(): Promise<TeamSelectionSnapshot> {
    return teamSelectionSnapshot;
  }

  async saveLineup(): Promise<TeamSelectionSnapshot> {
    return teamSelectionSnapshot;
  }

  async updateChip(): Promise<TeamSelectionSnapshot> {
    return teamSelectionSnapshot;
  }
}

class MemoryPreferenceClient implements PreferenceClient {
  preferences: UserPreferences = { themePreset: 'classic' };

  async getPreferences(): Promise<UserPreferences> {
    return this.preferences;
  }

  async updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
    this.preferences = preferences;
    return preferences;
  }
}

function renderApp(initialPath: string, session?: SessionState) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <App
        initialPath={initialPath}
        preferenceClient={new MemoryPreferenceClient()}
        session={session}
        teamSelectionClient={new MemoryTeamSelectionClient()}
      />,
    );
  });
  return { container, root };
}

describe('team selection shell integration', () => {
  test('routes authenticated managers to team selection inside shared shell', async () => {
    const { container } = renderApp('/team-selection', authenticatedSession);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Team Selection');
    expect(container.textContent).toContain('Lineup, chips, bench, and reserves');
    expect(container.textContent).toContain('Signed in as CDL Manager');
  });

  test('blocks unauthenticated team selection route before rendering feature UI', () => {
    const session: SessionState = {
      isAuthenticated: false,
      user: null,
      expiresAt: null,
    };

    const { container } = renderApp('/team-selection', session);

    expect(container.textContent).toContain('Sign in to access');
    expect(container.textContent).not.toContain('Lineup, chips, bench, and reserves');
  });
});
