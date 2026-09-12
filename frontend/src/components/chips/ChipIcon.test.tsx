import { describe, expect, test } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { ChipIcon } from './ChipIcon';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('ChipIcon', () => {
  test('renders each supplied chip concept as an inline theme-aware SVG', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <>
          <ChipIcon variant="triple-captain" />
          <ChipIcon variant="dual-captain" />
          <ChipIcon variant="bench-boost" />
          <ChipIcon variant="auto-captain" />
        </>,
      );
    });

    expect(host.querySelectorAll('svg.chip-icon')).toHaveLength(4);
    expect(host.querySelector('.chip-icon--triple-captain circle[fill="currentColor"]')).not.toBeNull();
    expect(host.querySelector('.chip-icon--dual-captain text')?.textContent).toBe('VC');
    expect(host.querySelector('.chip-icon--bench-boost g[stroke="var(--surface)"]')).not.toBeNull();
    expect(host.querySelector('.chip-icon--auto-captain path[stroke="var(--surface)"]')).not.toBeNull();

    act(() => root.unmount());
    host.remove();
  });
});
