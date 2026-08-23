import { expect, test } from 'vitest';

import { getDefaultThemePreset, getThemeMode, resolveThemePreset, themePresets } from './theme-presets';

test('default preset is teal light', () => {
  expect(getDefaultThemePreset().name).toBe('teal-light');
});

test('light, dark, and adaptive workspace presets are available', () => {
  expect(themePresets.map((preset) => preset.name)).toEqual([
    'teal-light',
    'teal-dark',
    'adaptive',
  ]);
});

test('legacy preference names resolve to the new teal presets', () => {
  expect(resolveThemePreset('classic').name).toBe('teal-light');
  expect(resolveThemePreset('dark').name).toBe('teal-dark');
  expect(resolveThemePreset('compact').name).toBe('teal-light');
  expect(resolveThemePreset('teal-dark-compact').name).toBe('teal-dark');
});

test('adaptive mode follows the local daytime window', () => {
  const adaptive = resolveThemePreset('adaptive');

  expect(getThemeMode(adaptive, new Date(2026, 7, 23, 6, 59))).toBe('dark');
  expect(getThemeMode(adaptive, new Date(2026, 7, 23, 7, 0))).toBe('light');
  expect(getThemeMode(adaptive, new Date(2026, 7, 23, 18, 59))).toBe('light');
  expect(getThemeMode(adaptive, new Date(2026, 7, 23, 19, 0))).toBe('dark');
});
