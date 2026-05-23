import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { App } from './App';
import type { SessionState, UserPreferences } from './contracts';
import type { FdrClient, FdrCombinedResponse, FdrFilters } from './fdr-api';
import type { PreferenceClient } from './preferences-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

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

class MemoryFdrClient implements FdrClient {
  async getFdr(filters: FdrFilters): Promise<FdrCombinedResponse> {
    const gameweek = { id: 'gw-12', name: 'Gameweek 12', number: filters.gameweekStart };
    const arsenal = { id: 'arsenal', name: 'Arsenal', shortName: 'ARS' };
    const city = { id: 'man-city', name: 'Manchester City', shortName: 'MCI' };
    const view = {
      filters,
      scales: [],
      availableTeams: [arsenal, city],
      availableGameweeks: [gameweek],
      rows: [
        {
          team: arsenal,
          averageRating: 2,
          fixtures: [
            {
              id: 'attack-arsenal-12',
              opponent: city,
              gameweek,
              venue: 'H',
              rating: 2,
              band: 'easy' as const,
              abbreviation: 'MCI (H)',
            },
          ],
        },
      ],
    };

    return {
      scales: [
        {
          rating: 2,
          band: 'easy',
          label: 'Easy',
          foregroundToken: 'fdr-2-foreground',
          backgroundToken: 'fdr-2-background',
          contrastRatio: 6.9,
        },
      ],
      attack: { ...view, view: 'attack' },
      defence: { ...view, view: 'defence' },
    };
  }
}

function renderApp(initialPath: string, session?: SessionState) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <App
        fdrClient={new MemoryFdrClient()}
        initialPath={initialPath}
        preferenceClient={new MemoryPreferenceClient()}
        session={session}
      />,
    );
  });
  return { container, root };
}

describe('FDR shell integration', () => {
  test('routes authenticated managers to FDR inside shared shell', async () => {
    const { container } = renderApp('/fdr');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('FDR');
    expect(container.textContent).toContain('Attack and defence FDR');
    expect(container.textContent).toContain('Signed in as CDL Manager');
  });

  test('blocks unauthenticated FDR route before rendering feature UI', () => {
    const session: SessionState = {
      isAuthenticated: false,
      user: null,
      expiresAt: null,
    };

    const { container } = renderApp('/fdr', session);

    expect(container.textContent).toContain('Sign in to access');
    expect(container.textContent).not.toContain('Attack and defence FDR');
  });
});
