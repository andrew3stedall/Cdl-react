import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { SquadManagementPage } from './SquadManagementPage';
import { getDefaultThemePreset } from './theme-presets';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

async function renderPage() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SquadManagementPage preset={getDefaultThemePreset()} />);
    await Promise.resolve();
  });
  return { container, root };
}

describe('SquadManagementPage', () => {
  test('renders squad summary and scouting table', async () => {
    const { container } = await renderPage();

    expect(container.textContent).toContain('Squad, scouting, interests, and transfers');
    expect(container.textContent).toContain('Total players');
    expect(container.textContent).toContain('Alex Keeper');
    expect(container.textContent).toContain('Casey Midfielder');
  });

  test('filters scouting players and creates interests', async () => {
    const { container } = await renderPage();
    const input = container.querySelector('input[aria-label="Search players"]') as HTMLInputElement;

    await act(async () => {
      input.value = 'casey';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(input.value).toBe('casey');
    expect(container.textContent).toContain('Casey Midfielder');

    const interestButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Interest')) as HTMLButtonElement;
    await act(async () => {
      interestButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('added to interests');
  });

  test('creates proposed trade with rules deep link and opens player detail', async () => {
    const { container } = await renderPage();
    const tradeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Propose sample trade') as HTMLButtonElement;

    await act(async () => {
      tradeButton.click();
      await Promise.resolve();
    });

    expect(container.querySelector('a[href="/rules#trade-window"]')?.textContent).toBe('Trade Window');

    const playerButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Casey Midfielder')) as HTMLButtonElement;
    await act(async () => {
      playerButton.click();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Casey Midfielder');
  });
});
