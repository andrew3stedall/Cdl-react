import { expect, test, vi } from 'vitest';

import {
  canAccessProtectedRoute,
  getGoogleAuthConfig,
  getProtectedRouteRedirect,
  getSession,
  getUnauthenticatedSession,
  login,
  loginWithGoogleCredential,
} from './auth';
import type { SessionState } from './contracts';

test('unauthenticated session cannot access protected route', () => {
  const session = getUnauthenticatedSession();

  expect(canAccessProtectedRoute(session)).toBe(false);
  expect(getProtectedRouteRedirect(session)).toBe('/login');
});

test('authenticated session can access protected route', () => {
  const session: SessionState = {
    isAuthenticated: true,
    expiresAt: null,
    user: {
      id: 'user-1',
      email: 'manager@example.com',
      displayName: 'Demo Manager',
      roles: ['manager'],
    },
  };

  expect(canAccessProtectedRoute(session)).toBe(true);
  expect(getProtectedRouteRedirect(session)).toBeNull();
});


test('maps the backend snake-case session contract for React', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    is_authenticated: true,
    user: {
      id: 'user-1',
      email: 'manager@example.com',
      display_name: 'Mapped Manager',
      roles: ['manager'],
    },
    expires_at: '2099-01-01T00:00:00Z',
  }), { status: 200 })));

  const session = await getSession();

  expect(session).toEqual({
    isAuthenticated: true,
    user: {
      id: 'user-1',
      email: 'manager@example.com',
      displayName: 'Mapped Manager',
      roles: ['manager'],
    },
    expiresAt: '2099-01-01T00:00:00Z',
  });
  vi.unstubAllGlobals();
});

test('session outage rejects instead of pretending the user is logged out', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    code: 'server_error',
    message: 'Session verification is temporarily unavailable. Retry.',
    details: {},
  }), { status: 503 })));

  await expect(getSession()).rejects.toThrow('Session verification is temporarily unavailable. Retry.');
  vi.unstubAllGlobals();
});

test('expired session cannot access a protected route', () => {
  const session: SessionState = {
    isAuthenticated: true,
    user: {
      id: 'user-1',
      email: 'manager@example.com',
      displayName: 'Expired Manager',
      roles: ['manager'],
    },
    expiresAt: '2000-01-01T00:00:00Z',
  };

  expect(canAccessProtectedRoute(session)).toBe(false);
});


test('maps a successful backend login response', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    session: {
      is_authenticated: true,
      user: {
        id: 'user-1',
        email: 'manager@example.com',
        display_name: 'Login Manager',
        roles: ['manager'],
      },
      expires_at: '2099-01-01T00:00:00Z',
    },
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  const result = await login({ email: 'manager@example.com', password: 'test-secret' });

  expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
    method: 'POST',
    credentials: 'include',
  }));
  expect(result).toEqual({
    ok: true,
    data: {
      session: {
        isAuthenticated: true,
        user: {
          id: 'user-1',
          email: 'manager@example.com',
          displayName: 'Login Manager',
          roles: ['manager'],
        },
        expiresAt: '2099-01-01T00:00:00Z',
      },
    },
  });
  vi.unstubAllGlobals();
});

test('preserves the generic invalid-credentials response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    code: 'unauthenticated',
    message: 'Invalid email or password.',
    details: {},
  }), { status: 401 })));

  const result = await login({ email: 'manager@example.com', password: 'wrong' });

  expect(result).toEqual({
    ok: false,
    error: {
      code: 'unauthenticated',
      message: 'Invalid email or password.',
      details: {},
    },
  });
  vi.unstubAllGlobals();
});

test('maps enabled Google sign-in configuration', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    enabled: true,
    client_id: 'staging-client.apps.googleusercontent.com',
  }), { status: 200 })));

  await expect(getGoogleAuthConfig()).resolves.toEqual({
    enabled: true,
    clientId: 'staging-client.apps.googleusercontent.com',
  });
  vi.unstubAllGlobals();
});

test('posts Google credential with the same-origin sign-in header', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    session: {
      is_authenticated: true,
      user: {
        id: 'google:subject-1',
        email: 'andrew3stedall@gmail.com',
        display_name: 'Andrew Stedall',
        roles: ['manager'],
      },
      expires_at: null,
    },
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  const result = await loginWithGoogleCredential('signed-google-id-token');

  expect(fetchMock).toHaveBeenCalledWith('/api/auth/google', expect.objectContaining({
    method: 'POST',
    credentials: 'include',
    headers: expect.objectContaining({ 'X-CDL-Google-Sign-In': '1' }),
  }));
  expect(result.ok).toBe(true);
  vi.unstubAllGlobals();
});

test('preserves structured Google database outage response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    code: 'server_error',
    message: 'Google sign-in is temporarily unavailable. Try again.',
    details: {},
  }), { status: 503 })));

  const result = await loginWithGoogleCredential('signed-google-id-token');

  expect(result).toEqual({
    ok: false,
    error: {
      code: 'server_error',
      message: 'Google sign-in is temporarily unavailable. Try again.',
      details: {},
    },
  });
  vi.unstubAllGlobals();
});

test('Google infrastructure failure with non-JSON body still returns a safe error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream failure', { status: 500 })));

  const result = await loginWithGoogleCredential('signed-google-id-token');

  expect(result).toEqual({
    ok: false,
    error: {
      code: 'server_error',
      message: 'Google sign-in is temporarily unavailable. Try again.',
      details: {},
    },
  });
  vi.unstubAllGlobals();
});