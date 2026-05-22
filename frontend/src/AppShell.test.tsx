import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { App } from './App';
import type { SessionState, UserPreferences } from './contracts';
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

function renderApp(
  preferenceClient = new MemoryPreferenceClient(),
  initialPath = '/dashboard',
  session?: SessionState,
) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <App initialPath={initialPath} preferenceClient={preferenceClient} session={session} />,
    );
  });

  return { container, preferenceClient, root };
}

describe('AppShell integration', () => {
  test('renders route-aware authenticated navigation around rules content', async () => {
    const { container } = renderApp(undefined, '/rules');

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Rules');
    expect(container.textContent).toContain('Rules Knowledge Base');
    expect(container.textContent).toContain('Sign out');
    expect(container.textContent).toContain('Scouting');
  });

  test('renders league content through the shared shell', async () => {
    const { container } = renderApp(undefined, '/league');

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('League');
    expect(container.textContent).toContain('League Fixtures and Table');
    expect(container.textContent).toContain('League standings');
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
  });

  test('persists visual preset selections', async () => {
    const preferenceClient = new MemoryPreferenceClient();
    const { container } = renderApp(preferenceClient);

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
    const { container } = renderApp(undefined, '/rules', unauthenticatedSession);

    expect(container.textContent).toContain('Sign in to access');
    expect(container.textContent).not.toContain('Rules Knowledge Base');
  });
});
