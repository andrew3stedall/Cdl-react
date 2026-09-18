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

test('adaptive mode follows the system appearance setting', () => {
  const adaptive = resolveThemePreset('adaptive');

  expect(getThemeMode(adaptive, false)).toBe('light');
  expect(getThemeMode(adaptive, true)).toBe('dark');
});
