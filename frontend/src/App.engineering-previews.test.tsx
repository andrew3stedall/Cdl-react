import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { App } from './App';
import type { SessionState } from './contracts';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
const mountedRoots: ReturnType<typeof createRoot>[] = [];

const baseSession: SessionState = {
  isAuthenticated: true,
  user: { id: 'manager-1', email: 'manager@example.com', displayName: 'Manager', roles: ['manager'] },
  expiresAt: null,
};

afterEach(async () => {
  await act(async () => { mountedRoots.splice(0).forEach((root) => root.unmount()); });
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

async function renderPreview(engineeringPreviewsEnabled: boolean) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  await act(async () => {
    root.render(<App initialPath="/modernisation/checkpoint-2" session={{ ...baseSession, engineeringPreviewsEnabled }} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

describe('engineering preview route capability', () => {
  test('shows an unavailable state when the session does not enable previews', async () => {
    const { container } = await renderPreview(false);

    expect(container.querySelector('#preview-unavailable-title')?.textContent).toBe('Preview unavailable');
    expect(container.textContent).not.toContain('Checkpoint 2:');
  });

  test('renders the checkpoint only when the session enables previews', async () => {
    const { container } = await renderPreview(true);

    expect(container.querySelector('#preview-unavailable-title')).toBeNull();
    await vi.waitFor(async () => {
      await act(async () => { await Promise.resolve(); });
      expect(container.querySelector('#modernisation-checkpoint-title')?.textContent).toBe('Weekly gameplay contracts');
    });
  });
});
