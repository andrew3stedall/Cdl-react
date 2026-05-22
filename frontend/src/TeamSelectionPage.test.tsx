import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { TeamSelectionPage } from './TeamSelectionPage';
import { getDefaultThemePreset } from './theme-presets';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

async function renderPage() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<TeamSelectionPage preset={getDefaultThemePreset()} />);
    await Promise.resolve();
  });
  return { container, root };
}

describe('TeamSelectionPage', () => {
  test('renders lineup, chips, bench, reserves, and fixture context', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Lineup, chips, bench, and reserves');
    expect(container.textContent).toContain('Wildcard');
    expect(container.textContent).toContain('Starters');
    expect(container.textContent).toContain('Bench');
    expect(container.textContent).toContain('Reserves');
    expect(container.textContent).toContain('Castle FC vs Rival Town');
  });

  test('activates available chip and rejects used chip activation', async () => {
    const { container } = await renderPage();
    const buttons = Array.from(container.querySelectorAll('button'));
    const wildcardButton = buttons.find((button) => button.textContent === 'Activate') as HTMLButtonElement;

    await act(async () => {
      wildcardButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Wildcard chip state updated.');
    expect(container.textContent).toContain('active');

    const benchBoostButton = Array.from(container.querySelectorAll('button')).find((button) => {
      return button.parentElement?.textContent?.includes('Bench Boost');
    }) as HTMLButtonElement;

    await act(async () => {
      benchBoostButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Used chips cannot be activated');
  });

  test('shows invalid lineup message when moving a starter to bench', async () => {
    const { container } = await renderPage();
    const select = container.querySelector('select[aria-label="Move Alex Keeper"]') as HTMLSelectElement;

    await act(async () => {
      select.value = 'bench';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save lineup') as HTMLButtonElement;
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Invalid lineup');
    expect(container.textContent).toContain('/rules#lineup-validation');
  });
});
