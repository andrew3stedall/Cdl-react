import { describe, expect, test } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { ChipIcon } from './ChipIcon';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('ChipIcon', () => {
  test('renders every chip concept as a theme-aware inline SVG', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <>
          <ChipIcon variant="triple-captain" />
          <ChipIcon variant="dual-captain" />
          <ChipIcon variant="question-captain" />
          <ChipIcon variant="bench-boost" />
          <ChipIcon variant="auto-captain" />
        </>,
      );
    });

    expect(host.querySelectorAll('svg.chip-icon')).toHaveLength(5);
    expect(host.querySelector('.chip-icon--triple-captain circle[stroke="currentColor"]')).not.toBeNull();
    expect(host.querySelector('.chip-icon--dual-captain circle[stroke="currentColor"]')).not.toBeNull();
    expect(Array.from(host.querySelectorAll('.chip-icon--dual-captain text')).map((text) => text.textContent)).toEqual(['VC', 'x2']);
    expect(host.querySelector('.chip-icon--triple-captain circle')?.getAttribute('clip-path')).toBe('url(#captain-circle-clip-triple-captain)');
    expect(host.querySelector('.chip-icon--dual-captain circle')?.getAttribute('clip-path')).toBe('url(#captain-circle-clip-dual-captain)');
    expect(host.querySelector('.chip-icon--triple-captain text')?.getAttribute('font-size')).toBe('12.5');
    expect(host.querySelector('.chip-icon--dual-captain text')?.getAttribute('font-size')).toBe('8.6');
    expect(host.querySelectorAll('.chip-icon--triple-captain text')[1]?.getAttribute('font-size')).toBe('18.5');
    expect(host.querySelectorAll('.chip-icon--dual-captain text')[1]?.getAttribute('font-size')).toBe('18.5');
    expect(Array.from(host.querySelectorAll('.chip-icon--question-captain text')).map((text) => text.textContent)).toEqual(['?', '2x']);
    expect(host.querySelector('.chip-icon--question-captain circle')?.getAttribute('clip-path')).toBe('url(#captain-circle-clip-question-captain)');
    expect(host.querySelector('.chip-icon--question-captain text')?.getAttribute('font-size')).toBe('46');
    expect(host.querySelectorAll('.chip-icon--question-captain text')[1]?.getAttribute('font-size')).toBe('18.5');
    expect(host.querySelector('.chip-icon--triple-captain [fill="var(--surface)"]')).not.toBeNull();
    expect(host.querySelector('.chip-icon--bench-boost g[stroke="var(--surface)"]')).not.toBeNull();
    expect(host.querySelector('.chip-icon--auto-captain path[stroke="var(--surface)"]')).not.toBeNull();

    act(() => root.unmount());
    host.remove();
  });
});
