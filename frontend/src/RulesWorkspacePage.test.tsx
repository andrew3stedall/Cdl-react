import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
import { RulesWorkspacePage } from './RulesWorkspacePage';
import type { RulesIndexResponse } from './contracts';
import { themePresets } from './theme-presets';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const version = { version: '2026.10', effectiveDate: '2026-10-03', status: 'active', source: 'accepted rules' };
const rules: RulesIndexResponse = { version, categories: ['chips', 'matchday'], sections: [
  { id: 'chip-usage', title: 'Chips', category: 'chips', summary: 'One chip per gameweek.', body: ['Reserves are excluded.'], tags: ['chip'], anchors: ['chip-usage', 'chip-use'], relatedRuleIds: [], version },
  { id: 'captaincy', title: 'Captaincy', category: 'matchday', summary: 'Captain must start.', body: ['Choose a different vice-captain.'], tags: ['captain'], anchors: ['captaincy'], relatedRuleIds: [], version },
] };
let cleanup = () => {};
afterEach(() => cleanup());

test('recovers failed API read and filters loaded sections', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(rules);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  cleanup = () => { act(() => root.unmount()); host.remove(); };
  await act(async () => { root.render(<RulesWorkspacePage loadRules={load} preset={themePresets[0]} />); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
  await act(async () => { (host.querySelector('button') as HTMLButtonElement).click(); });
  expect(host.querySelector('#captaincy')).not.toBeNull();
  expect(host.querySelector('#chip-use')).not.toBeNull();
  await act(async () => {
    const select = host.querySelector('select')!;
    select.value = 'chips';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(host.querySelector('#captaincy')).toBeNull();
  expect(host.querySelector('#chip-usage')).not.toBeNull();
  await act(async () => { (Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Clear filters')!).click(); });
  expect(host.querySelector('#captaincy')).not.toBeNull();
});
