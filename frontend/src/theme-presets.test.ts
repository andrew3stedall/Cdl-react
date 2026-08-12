import { expect, test } from 'vitest';

import { getDefaultThemePreset, resolveThemePreset, themePresets } from './theme-presets';

test('default preset is teal light', () => {
  expect(getDefaultThemePreset().name).toBe('teal-light');
});

test('only the light and dark workspace presets are available', () => {
  expect(themePresets.map((preset) => preset.name)).toEqual([
    'teal-light',
    'teal-dark',
  ]);
});

test('legacy preference names resolve to the new teal presets', () => {
  expect(resolveThemePreset('classic').name).toBe('teal-light');
  expect(resolveThemePreset('dark').name).toBe('teal-dark');
  expect(resolveThemePreset('compact').name).toBe('teal-light');
  expect(resolveThemePreset('teal-dark-compact').name).toBe('teal-dark');
});
