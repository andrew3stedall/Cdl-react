import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { App } from './App';
import type { SessionState, UserPreferences } from './contracts';
import type { LeagueClient, LeagueSnapshot } from './league-api';
import type { PreferenceClient } from './preferences-api';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
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

class MemoryLeagueClient implements LeagueClient {
  async getLeagueSnapshot(): Promise<LeagueSnapshot> {
    const castle = { id: 'castle', name: 'Castle United', shortName: 'CAS' };
    const drafton = { id: 'drafton', name: 'Drafton Rovers', shortName: 'DRA' };
    const gameweek = { id: 'gw-12', name: 'Gameweek 12', number: 12 };
    const fixture = {
      id: 'fixture-1201',
      gameweek,
      homeTeam: castle,
      awayTeam: drafton,
      status: 'started' as const,
      kickoffLabel: 'GW12 live',
      roundLabel: 'Regular season',
      isCurrent: true,
      isNext: false,
      detailAvailable: true,
      score: {
        homeScore: 58,
        awayScore: 52,
        bonusPoints: { castle: 3 },
        chipsPlayed: { castle: ['Triple Captain'] },
        outcome: 'home_win' as const,
      },
    };

    return {
      currentFixtures: { gameweek, fixtures: [fixture] },
      nextFixtures: { gameweek: { id: 'gw-13', name: 'Gameweek 13', number: 13 }, fixtures: [] },
      allFixtures: { gameweek: null, fixtures: [fixture] },
      table: {
        source: 'service-calculated',
        rows: [
          {
            position: 1,
            team: castle,
            played: 1,
            wins: 1,
            draws: 0,
            losses: 0,
            pointsFor: 58,
            pointsAgainst: 52,
            pointsDifference: 6,
            leaguePoints: 3,
          },
        ],
      },
      knockout: { rounds: ['Semi Final'], matches: [] },
      headToHead: {
        records: [
          {
            team: castle,
            opponent: drafton,
            played: 1,
            wins: 1,
            draws: 0,
            losses: 0,
            pointsFor: 58,
            pointsAgainst: 52,
          },
        ],
      },
    };
  }
}

function renderApp({
  preferenceClient = new MemoryPreferenceClient(),
  initialPath = '/dashboard',
  session,
  leagueClient = new MemoryLeagueClient(),
}: {
  preferenceClient?: PreferenceClient;
  initialPath?: string;
  session?: SessionState;
  leagueClient?: LeagueClient;
} = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <App
        initialPath={initialPath}
        leagueClient={leagueClient}
        preferenceClient={preferenceClient}
        session={session}
      />,
    );
  });

  return { container, preferenceClient, root };
}

describe('AppShell integration', () => {
  test('renders route-aware authenticated navigation around rules content', async () => {
    const { container } = renderApp({ initialPath: '/rules' });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Rules');
    expect(container.textContent).toContain('Rules Knowledge Base');
    expect(container.textContent).toContain('Sign out');
    expect(container.textContent).toContain('Scouting');
  });

  test('renders league content from the league API client through the shared shell', async () => {
    const { container } = renderApp({ initialPath: '/league' });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('League');
    expect(container.textContent).toContain('League Fixtures and Table');
    expect(container.textContent).toContain('Gameweek 12');
    expect(container.textContent).toContain('Castle United');
    expect(container.textContent).toContain('58 - 52');
  });

  test('opens mobile navigation drawer and updates active route', async () => {
    const { container } = renderApp();
    const menuButton = container.querySelector('.mobile-menu-button') as HTMLButtonElement;

    await act(async () => {
      menuButton.click();
      await Promise.resolve();
    });

    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Close');

    const leagueButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'League',
    ) as HTMLButtonElement;

    await act(async () => {
      leagueButton.click();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('League');
    expect(container.textContent).toContain('League Fixtures and Table');
    expect(container.textContent).toContain('Castle United');
  });

  test('persists visual preset selections', async () => {
    const preferenceClient = new MemoryPreferenceClient();
    const { container } = renderApp({ preferenceClient });

    await act(async () => {
      await Promise.resolve();
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    select.value = 'compact';

    await act(async () => {
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(preferenceClient.preferences.themePreset).toBe('compact');
    expect(document.documentElement.dataset.themePreset).toBe('compact');
  });

  test('blocks unauthenticated shell access', () => {
    const unauthenticatedSession: SessionState = {
      isAuthenticated: false,
      user: null,
      expiresAt: null,
    };
    const { container } = renderApp({ initialPath: '/rules', session: unauthenticatedSession });

    expect(container.textContent).toContain('Sign in to access');
    expect(container.textContent).not.toContain('Rules Knowledge Base');
  });
});
