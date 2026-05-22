import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { App } from './App';
import type { SessionState, UserPreferences } from './contracts';
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
      />,
    );
  });
  return { container, root };
}

describe('team selection shell integration', () => {
  test('routes authenticated managers to team selection inside shared shell', async () => {
    const { container } = renderApp('/team-selection');

    await act(async () => {
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
