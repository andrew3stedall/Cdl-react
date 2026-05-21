import { expect, test } from 'vitest';

import {
  canAccessProtectedRoute,
  getProtectedRouteRedirect,
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
