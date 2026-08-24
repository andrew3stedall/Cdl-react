import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { App } from './App';
import type { SessionState, UserPreferences } from './contracts';
import type { LeagueClient, LeagueSnapshot } from './league-api';
import type { FdrCustomPalette } from './fdr-colour-scales';
import type { FdrCustomPaletteDraft, PreferenceClient } from './preferences-api';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const authenticatedSession: SessionState = {
  isAuthenticated: true,
  user: {
    id: 'test-manager',
    email: 'manager@example.com',
    displayName: 'Test Manager',
    roles: ['manager'],
  },
  expiresAt: null,
};

class MemoryPreferenceClient implements PreferenceClient {
  palettes: FdrCustomPalette[] = [];
  preferences: UserPreferences = {
    themePreset: 'teal-light',
    attackDirection: 'up',
    fdrScale: 'RdYlGn',
    fdrScaleReversed: true,
  };

  async getPreferences(): Promise<UserPreferences> {
    return this.preferences;
  }

  async updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
    this.preferences = preferences;
    return preferences;
  }

  async getFdrCustomPalettes(): Promise<FdrCustomPalette[]> {
    return this.palettes;
  }

  async createFdrCustomPalette(palette: FdrCustomPaletteDraft): Promise<FdrCustomPalette> {
    const saved = { ...palette, id: `palette-${this.palettes.length + 1}` };
    this.palettes = [...this.palettes, saved];
    return saved;
  }

  async deleteFdrCustomPalette(paletteId: string): Promise<void> {
    this.palettes = this.palettes.filter((palette) => palette.id !== paletteId);
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
  session = authenticatedSession,
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
  test('renders the global feature hierarchy consistently around rules content', async () => {
    const { container } = renderApp({ initialPath: '/rules' });

    await act(async () => {
      await Promise.resolve();
    });

    const primaryNavigation = container.querySelector('nav[aria-label="Primary navigation"]');
    const mobileNavigation = container.querySelector('nav[aria-label="Global mobile navigation"]');
    const supportNavigation = container.querySelector('nav[aria-label="Support navigation"]');

    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Rules');
    expect(container.textContent).toContain('Rules Knowledge Base');
    expect(primaryNavigation?.textContent).toContain('Desk');
    expect(primaryNavigation?.textContent).toContain('Squad');
    expect(primaryNavigation?.textContent).toContain('Market');
    expect(primaryNavigation?.textContent).toContain('League');
    expect(primaryNavigation?.textContent).not.toContain('Matchweek');
    expect(primaryNavigation?.textContent).not.toContain('Scouting');
    expect(mobileNavigation?.textContent).toBe(primaryNavigation?.textContent);
    expect(supportNavigation?.textContent).toContain('Rules');
    expect(container.querySelector('[aria-label="Account menu for Test Manager"]')).not.toBeNull();
    expect(container.querySelector('#mobile-navigation')).toBeNull();
    expect(container.querySelector('button[aria-label="Menu"]')).toBeNull();
  });

  test('places account controls on the Managers Desk surface', async () => {
    const { container } = renderApp({ initialPath: '/' });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="Account settings"]')).toBeNull();
    expect(container.querySelector('[aria-label="Account menu for Test Manager"]')).not.toBeNull();
    expect(container.querySelector('#manager-desk-visual-preset')).toBeNull();
    expect(container.textContent).toContain('Account');
    expect(container.textContent).not.toContain('Profile & preferences');
    expect(container.textContent).not.toContain('Refresh data');
    expect(container.textContent).toContain('Sign out');
    expect(container.querySelector('nav[aria-label="Global mobile navigation"]')).not.toBeNull();

    const accountMenu = container.querySelector<HTMLElement>('.manager-account-menu');
    expect(accountMenu).not.toBeNull();
    const accountButton = accountMenu?.querySelector<HTMLButtonElement>('button');
    await act(async () => {
      accountButton?.click();
      await Promise.resolve();
    });
    expect(container.querySelector('main[aria-labelledby="account-title"]')).not.toBeNull();
    expect(container.textContent).toContain('Refresh data');
  });

  test('renders the single League page through the shared shell', async () => {
    const { container } = renderApp({ initialPath: '/league' });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('League');
    expect(container.querySelector('nav[aria-label="League navigation"]')).toBeNull();
    expect(container.textContent).toContain('Castle Draft League');
    expect(container.textContent).toContain('Fixtures');
    expect(container.textContent).toContain('Table');
    expect(container.textContent).toContain('Gameweek 12');
    expect(container.textContent).toContain('CAS');
    expect(container.textContent).not.toContain('Overview stays lightweight');
  });

  test('provides an account profile with persisted appearance controls', async () => {
    const preferenceClient = new MemoryPreferenceClient();
    const { container } = renderApp({ initialPath: '/account', preferenceClient });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('h1')?.textContent).toBe('Account');
    expect(container.textContent).not.toContain('Profile & preferences');
    expect(container.textContent).toContain('Test Manager');
    expect(container.textContent).toContain('Refresh data');
    expect(container.textContent).toContain('Sign out');
    expect(container.querySelector('.profile-direction-option[aria-pressed="true"]')?.textContent).toContain('Attack upwards');

    const darkOption = [...container.querySelectorAll<HTMLButtonElement>('.profile-preset-option')]
      .find((option) => option.textContent?.includes('Dark mode'));
    expect(darkOption).toBeDefined();

    await act(async () => {
      darkOption?.click();
      await Promise.resolve();
    });

    expect(preferenceClient.preferences.themePreset).toBe('teal-dark');
    expect(document.documentElement.dataset.themeMode).toBe('dark');

    const fdrScaleTrigger = container.querySelector<HTMLButtonElement>('.profile-fdr-scale-trigger');
    await act(async () => {
      fdrScaleTrigger?.click();
      await Promise.resolve();
    });
    expect(container.querySelector('#fdr-scale-sheet')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelectorAll('.profile-fdr-scale-option')).toHaveLength(7);
    expect([...container.querySelectorAll('.profile-fdr-scale-option__number')].map((number) => number.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(container.querySelectorAll('[aria-label^="Delete saved FDR palette"]').length).toBe(0);
    expect(container.querySelector('#fdr-scale-sheet')?.textContent).not.toContain('Viridis');
    expect(container.querySelector('.profile-fdr-preview__labels')?.textContent).toContain('Very easy');
    expect(container.querySelector('.profile-fdr-preview .profile-fdr-palette-bar')?.textContent).toBe('12345');
    expect(container.textContent).not.toContain('Light theme');

    const redBlueOption = container.querySelector<HTMLButtonElement>('[data-scale-name="RdBu"]');
    await act(async () => {
      redBlueOption?.click();
      await Promise.resolve();
    });
    expect(preferenceClient.preferences.fdrScale).toBe('RdBu');
    expect(document.documentElement.dataset.fdrScale).toBe('RdBu');

    const blueOption = container.querySelector<HTMLButtonElement>('[aria-label="Blue theme colour"]');
    await act(async () => {
      blueOption?.click();
      await Promise.resolve();
    });
    expect(preferenceClient.preferences.lightThemeColour).toBe('#2563EB');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#6B95F1');

    const reverseOrder = container.querySelector<HTMLInputElement>('.profile-fdr-reverse-toggle input');
    await act(async () => {
      reverseOrder?.click();
      await Promise.resolve();
    });
    expect(preferenceClient.preferences.fdrScaleReversed).toBe(false);

    const fillMode = container.querySelector<HTMLButtonElement>('.profile-fdr-display-option[aria-pressed="false"]');
    expect(fillMode?.textContent).toContain('Coloured fill');
    await act(async () => {
      fillMode?.click();
      await Promise.resolve();
    });
    expect(preferenceClient.preferences.fdrDisplayMode).toBe('fill');
    expect(document.documentElement.dataset.fdrDisplayMode).toBe('fill');
    expect(document.documentElement.style.getPropertyValue('--cdl-fdr-fill-foreground-1')).toMatch(/^#(000000|FFFFFF)$/);

    const paletteName = container.querySelector<HTMLInputElement>('[aria-label="Saved FDR palette name"]');
    await act(async () => {
      if (paletteName) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(paletteName, 'Weekend watch');
        paletteName.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await Promise.resolve();
    });
    const savePalette = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Save palette'));
    await act(async () => {
      savePalette?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(preferenceClient.palettes.map((palette) => palette.name)).toEqual(['Weekend watch']);
    expect(container.textContent).toContain('Weekend watch');
    expect(container.querySelector('[aria-label="Delete saved FDR palette Weekend watch"]')).not.toBeNull();

    const useSavedPalette = [...container.querySelectorAll<HTMLButtonElement>('.profile-fdr-saved-palette button')]
      .find((button) => button.textContent === 'Use');
    await act(async () => {
      useSavedPalette?.click();
      await Promise.resolve();
    });
    expect(preferenceClient.preferences.fdrScale).toBe('CustomHex');

    const deleteSavedPalette = container.querySelector<HTMLButtonElement>('[aria-label="Delete saved FDR palette Weekend watch"]');
    await act(async () => {
      deleteSavedPalette?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(preferenceClient.palettes).toHaveLength(0);

    const attackDownOption = container.querySelector<HTMLButtonElement>('.profile-direction-option[aria-pressed="false"]');
    expect(attackDownOption?.textContent).toContain('Attack downwards');
    await act(async () => {
      attackDownOption?.click();
      await Promise.resolve();
    });
    expect(preferenceClient.preferences.attackDirection).toBe('down');
  });

  test('passes the persisted preset into page-level density consumers', async () => {
    const preferenceClient = new MemoryPreferenceClient();
    preferenceClient.preferences = {
      themePreset: 'teal-dark',
      attackDirection: 'up',
      fdrScale: 'RdYlGn',
      fdrScaleReversed: true,
    };
    const { container } = renderApp({ initialPath: '/rules', preferenceClient });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-preset="teal-dark"]')).not.toBeNull();
    expect(document.documentElement.dataset.themePreset).toBe('teal-dark');
  });
});
