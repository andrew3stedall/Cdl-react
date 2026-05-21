import { expect, test } from 'vitest';

import type { SessionState } from './contracts';
import { getRulesRouteRedirect } from './rules';

test('rules route redirects unauthenticated sessions', () => {
  const session: SessionState = {
    isAuthenticated: false,
    user: null,
    expiresAt: null,
  };

  expect(getRulesRouteRedirect(session)).toBe('/login?next=/rules');
});

test('rules route allows authenticated sessions', () => {
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

  expect(getRulesRouteRedirect(session)).toBeNull();
});
