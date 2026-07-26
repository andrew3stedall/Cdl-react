import { expect, test, vi } from 'vitest';

import {
  canAccessProtectedRoute,
  getProtectedRouteRedirect,
  getSession,
  getUnauthenticatedSession,
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
