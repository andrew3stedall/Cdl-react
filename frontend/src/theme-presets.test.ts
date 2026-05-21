import { expect, test } from 'vitest';

import { getDefaultThemePreset, themePresets } from './theme-presets';

test('default preset is classic', () => {
  expect(getDefaultThemePreset().name).toBe('classic');
});

test('initial presets exist', () => {
  expect(themePresets.length).toBe(3);
});
