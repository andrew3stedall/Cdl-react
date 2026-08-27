import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { App } from './App';
import type { SessionState } from './contracts';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const session: SessionState = {
  isAuthenticated: true,
  user: {
    id: 'motion-manager',
    email: 'manager@example.com',
    displayName: 'Motion Manager',
    roles: ['manager'],
  },
  expiresAt: null,
};

const roots: Root[] = [];
const containers: HTMLDivElement[] = [];

beforeEach(() => {
  window.localStorage.clear();
});

function dispatchMotion(z: number, timeStamp: number) {
  const event = new Event('devicemotion') as Event & {
    acceleration: { x: number; y: number; z: number };
  };
  event.acceleration = { x: 0, y: 0, z };
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  window.dispatchEvent(event);
}

afterEach(() => {
  roots.forEach((root) => act(() => root.unmount()));
  containers.forEach((container) => container.remove());
  roots.length = 0;
  containers.length = 0;
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('account motion navigation', () => {
  test('opens Account after two alternating forward/back cycles from another page', async () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const container = document.createElement('div');
    document.body.append(container);
    containers.push(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(<App initialPath="/rules" session={session} />);
      await Promise.resolve();
    });

    expect(addEventListener.mock.calls.some(([type]) => type === 'devicemotion')).toBe(true);

    await act(async () => {
      [7, 0, -7, 0, 7, 0, -7].forEach((value, index) => dispatchMotion(value, (index + 1) * 140));
      await Promise.resolve();
    });

    expect(container.querySelector('main[aria-labelledby="account-title"]')).not.toBeNull();
  });

  test('does not add a listener when the shortcut is disabled', async () => {
    window.localStorage.setItem('cdl-account-motion-gesture-enabled', 'false');
    const container = document.createElement('div');
    document.body.append(container);
    containers.push(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(<App initialPath="/rules" session={session} />);
      await Promise.resolve();
    });

    await act(async () => {
      [7, 0, -7, 0, 7, 0, -7].forEach(dispatchMotion);
      await Promise.resolve();
    });

    expect(container.querySelector('main[aria-labelledby="account-title"]')).toBeNull();
    expect(container.textContent).toContain('Rules Knowledge Base');
  });
});
