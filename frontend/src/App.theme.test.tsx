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
    expect(container.textContent).toContain('Loading');
    expect(container.textContent).not.toContain('Own your league.');
    expect(container.textContent).not.toContain('Your league. Your strategy.');
    expect(container.textContent).not.toContain('Checking your session');
    expect(document.documentElement.dataset.themePreset).toBe('teal-dark');
    expect(document.documentElement.dataset.themeMode).toBe('dark');
  });

  test('uses a saved accent on the compact boot splash', () => {
    setThemePresetCookie('teal-dark');
    window.localStorage.setItem('cdl-theme-colour-variants', JSON.stringify({
      light: { primary: '#1D4ED8', secondary: '#0E7490', tertiary: '#0F766E', quaternary: '#4338CA' },
      dark: { primary: '#BE123C', secondary: '#9F1239', tertiary: '#DB2777', quaternary: '#C2410C' },
    }));
    const sessionClient: SessionClient = {
      getGoogleAuthConfig: vi.fn(async () => ({ enabled: false, clientId: null })),
      getSession: vi.fn(() => new Promise<SessionState>(() => undefined)),
      login: vi.fn(),
      loginWithGoogleCredential: vi.fn(),
      logout: vi.fn(),
    };

    act(() => root.render(<App initialPath="/" sessionClient={sessionClient} />));

    const splash = container.querySelector('.session-splash');
    expect(splash?.getAttribute('style')).toContain('--session-splash-background: #BE123C');
  });
  test('keeps the account open and offers retry when logout fails', async () => {
    const authenticated: SessionState = {
      isAuthenticated: true,
      user: { id: 'user-1', email: 'manager@example.com', displayName: 'Manager', roles: ['manager'] },
      expiresAt: null,
    };
    const sessionClient: SessionClient = {
      getGoogleAuthConfig: vi.fn(async () => ({ enabled: false, clientId: null })),
      getSession: vi.fn(async () => authenticated),
      login: vi.fn(),
      loginWithGoogleCredential: vi.fn(),
      logout: vi.fn()
        .mockRejectedValueOnce(new Error('database unavailable'))
        .mockResolvedValueOnce({ session: unauthenticatedSession }),
    };

    await act(async () => {
      root.render(<App initialPath="/" sessionClient={sessionClient} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      container.querySelector('details > summary')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    const signOut = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Sign out'));
    await act(async () => {
      signOut?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Sign out could not be confirmed');
    expect(container.querySelector('.app-shell')).not.toBeNull();
    const retry = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Retry sign out'));
    await act(async () => {
      retry?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sessionClient.logout).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.login-screen')).not.toBeNull();
  });

  test('restores an invite return path after the login tab reloads', async () => {
    const sessionClient: SessionClient = {
      getGoogleAuthConfig: vi.fn(async () => ({ enabled: false, clientId: null })),
      getSession: vi.fn(async () => unauthenticatedSession),
      login: vi.fn(),
      loginWithGoogleCredential: vi.fn(),
      logout: vi.fn(),
    };
    await act(async () => {
      root.render(<App initialPath="/join/invite-token" sessionClient={sessionClient} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(window.sessionStorage.getItem('cdl.loginReturnPath')).toBe('/join/invite-token');

    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(<App initialPath="/login" sessionClient={sessionClient} />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('League invitation');
  });
});
