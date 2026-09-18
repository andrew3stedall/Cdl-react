import { describe, expect, test } from 'vitest';

import { applyThemeColours, getThemeAccentColoursForMode, resolveThemeAccentColours } from './theme-colours';
import { resolveThemePreset } from './theme-presets';

describe('theme accent colours', () => {
  test('keeps the legacy single-colour value as the primary accent', () => {
    expect(resolveThemeAccentColours('#2563EB')).toEqual({
      primary: '#2563EB',
      secondary: '#115E59',
      tertiary: '#0D9488',
      quaternary: '#14B8A6',
    });
  });

  test('derives all four accents for dark mode', () => {
    expect(getThemeAccentColoursForMode({
      primary: '#2563EB',
      secondary: '#7C3AED',
      tertiary: '#BE123C',
      quaternary: '#C2410C',
    }, 'dark')).toEqual({
      primary: '#6B95F1',
      secondary: '#A679F3',
      tertiary: '#D35E7A',
      quaternary: '#D67E5A',
    });
  });

  test('applies independent accent hooks without changing the neutral secondary surface', () => {
    const preset = applyThemeColours(resolveThemePreset('teal-light'), {
      primary: '#2563EB',
      secondary: '#7C3AED',
      tertiary: '#BE123C',
      quaternary: '#C2410C',
    });

    expect(preset.tokens.colors.primary).toBe('#2563EB');
    expect(preset.tokens.colors.secondary).toBe('#f1f5f9');
    expect(preset.tokens.colors.tertiary).toBe('#BE123C');
    expect(preset.tokens.chartPaletteHooks.slice(0, 4)).toEqual(['#2563EB', '#7C3AED', '#BE123C', '#C2410C']);
  });
});
