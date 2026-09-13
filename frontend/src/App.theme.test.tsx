import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { App } from './App';
import type { SessionClient } from './auth';
import type { SessionState } from './contracts';
import { getStoredThemePreset, setThemePresetCookie, THEME_PRESET_COOKIE } from './theme-cookie';

const unauthenticatedSession: SessionState = {
  isAuthenticated: false,
  user: null,
  expiresAt: null,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  document.cookie = `${THEME_PRESET_COOKIE}=; Max-Age=0; Path=/`;
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.cookie = `${THEME_PRESET_COOKIE}=; Max-Age=0; Path=/`;
  window.localStorage.clear();
});

describe('sign-in theme bootstrap', () => {
  test('applies the device theme before rendering the sign-in page', async () => {
    setThemePresetCookie('teal-dark');

    act(() => {
      root.render(<App initialPath="/login" session={unauthenticatedSession} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('.login-screen')).not.toBeNull();
    expect(document.documentElement.dataset.themePreset).toBe('teal-dark');
    expect(document.documentElement.dataset.themeMode).toBe('dark');
    expect(getStoredThemePreset()).toBe('teal-dark');
  });

  test('shows a themed splash while the initial session is resolving', () => {
    setThemePresetCookie('teal-dark');

    const sessionClient: SessionClient = {
      getGoogleAuthConfig: vi.fn(async () => ({ enabled: false, clientId: null })),
      getSession: vi.fn(() => new Promise<SessionState>(() => undefined)),
      login: vi.fn(),
      loginWithGoogleCredential: vi.fn(),
      logout: vi.fn(),
    };

    act(() => {
      root.render(<App initialPath="/" sessionClient={sessionClient} />);
    });

    expect(container.querySelector('.session-splash')).not.toBeNull();
    expect(container.textContent).toContain('Preparing your workspace');
    expect(container.textContent).not.toContain('Checking your session');
    expect(document.documentElement.dataset.themePreset).toBe('teal-dark');
    expect(document.documentElement.dataset.themeMode).toBe('dark');
  });
});
