import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { SessionSplash } from './SessionSplash';
import { defaultThemeColour } from './theme-colours';

describe('session splash', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test('uses the default brand colour and white logo treatment', () => {
    act(() => {
      root.render(<SessionSplash onRetry={vi.fn()} />);
    });

    const splash = container.querySelector<HTMLElement>('.session-splash');
    const mark = container.querySelector<HTMLElement>('.session-splash__mark');

    expect(splash?.style.getPropertyValue('--session-splash-background')).toBe(defaultThemeColour);
    expect(mark?.textContent).toBe('CDL');
    expect(mark?.className).toContain('session-splash__mark');
  });
});
