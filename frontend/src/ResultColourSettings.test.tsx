import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import { ResultColourSettings } from './ResultColourSettings';
import type { ResultColourPalette } from './result-colours';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

function ResultColourHarness() {
  const [colours, setColours] = useState<ResultColourPalette>({
    win: '#00FFFF',
    draw: '#FFFF00',
    loss: '#FF00AA',
  });

  return <ResultColourSettings colours={colours} onChange={setColours} saveStatus="idle" />;
}

async function renderSettings() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(<ResultColourHarness />);
  });

  return container;
}

describe('ResultColourSettings', () => {
  test('uses the shared compact palette selector without hex rows', async () => {
    const view = await renderSettings();
    const selector = view.querySelector('[aria-label="Custom result colours"]');

    expect(selector).not.toBeNull();
    expect(selector?.querySelectorAll('button')).toHaveLength(3);
    expect(selector?.textContent).toBe('WinDrawLoss');
    expect(selector?.textContent).not.toMatch(/#[0-9A-F]{6}/i);
    expect(view.querySelector('input[type="color"]')).toBeNull();
  });

  test('switches the active colour using the same selector interaction as player palettes', async () => {
    const view = await renderSettings();
    const drawButton = view.querySelector<HTMLButtonElement>('[aria-label="Edit result Draw colour"]');

    expect(view.querySelector('[aria-label="Colour field for result Win"]')).not.toBeNull();

    await act(async () => {
      drawButton?.click();
    });

    expect(drawButton?.getAttribute('aria-pressed')).toBe('true');
    expect(view.querySelector('[aria-label="Colour field for result Draw"]')).not.toBeNull();
    expect(view.querySelector('[aria-label="Saturation for result Draw"]')).not.toBeNull();
    expect(view.querySelector('[aria-label="Exposure for result Draw"]')).not.toBeNull();
  });
});
