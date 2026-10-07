import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { App } from './App';
import type { SessionState } from './contracts';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const managerSession: SessionState = {
  isAuthenticated: true,
  user: { id: 'manager-1', email: 'manager@example.com', displayName: 'Manager', roles: ['manager'] },
  expiresAt: null,
};

describe('App live draft route', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = null;
    container?.remove();
    container = null;
    vi.unstubAllGlobals();
  });

  test('lazy-loads the draft workspace at the addressable League route', async () => {
    const requested: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      if (url.endsWith('/live-draft/availability')) return Response.json({ can_create: true, reason: null });
      if (url.endsWith('/live-draft/availability')) return Response.json({ can_create: true, reason: null });
      if (url.endsWith('/live-draft/teams')) return Response.json([{ id: 'team-1', name: 'Harbour' }]);
      if (url.endsWith('/live-draft')) return Response.json(null);
      return Response.json({});
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<App initialPath="/league/draft" session={managerSession} />);
      await import('./DraftWorkspacePage');
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(container.querySelector('[data-page-hero="shared"] h1')?.textContent).toBe('Live draft');
    expect(container.textContent).toContain('The commissioner has not created a draft room.');
    expect(requested).toContain('/api/live-draft');
    expect(requested).toContain('/api/live-draft/teams');
    expect(requested).toContain('/api/live-draft/availability');
  });

  test('passes commissioner capability so an authorized manager can create a room', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/live-draft/availability')) return Response.json({ can_create: true, reason: null });
      if (url.endsWith('/live-draft/teams')) return Response.json([{ id: 'team-1', name: 'Harbour' }]);
      if (url.endsWith('/live-draft')) return Response.json(null);
      return Response.json({});
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const commissionerSession = { ...managerSession, user: { ...managerSession.user!, roles: ['commissioner'] } };

    await act(async () => {
      root?.render(<App initialPath="/league/draft" session={commissionerSession} />);
      await import('./DraftWorkspacePage');
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('Set up the draft');
    expect([...container.querySelectorAll('button')].some((button) => button.textContent?.includes('Create draft room'))).toBe(true);
  });
});
