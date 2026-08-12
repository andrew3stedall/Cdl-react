import { describe, expect, test } from 'vitest';

import {
  defaultFdrDisplayMode,
  fdrColourScales,
  getFdrFillForeground,
  getFdrFillPalette,
  getFdrPalette,
  getFdrColourScale,
} from './fdr-colour-scales';

describe('FDR colour scales', () => {
  test('contains every non-categorical D3 interpolator as five hex steps', () => {
    expect(fdrColourScales).toHaveLength(32);
    expect(fdrColourScales.every((scale) => scale.light.length === 5 && scale.dark.length === 5)).toBe(true);
    expect(fdrColourScales.flatMap((scale) => [...scale.light, ...scale.dark]).every((colour) => /^#[0-9A-F]{6}$/.test(colour))).toBe(true);
    expect(fdrColourScales.filter((scale) => scale.group === 'Cyclical').map((scale) => scale.name)).toEqual([
      'Rainbow',
      'Sinebow',
    ]);
    expect(fdrColourScales.map((scale) => scale.name)).not.toEqual(expect.arrayContaining([
      'Blues', 'Greens', 'Greys', 'Oranges', 'Purples', 'Reds',
    ]));
  });

  test('reverses the selected FDR order without changing the scale colours', () => {
    const normal = getFdrPalette('RdYlGn', 'light', false);
    const reversed = getFdrPalette('RdYlGn', 'light', true);

    expect(reversed).toEqual([...normal].reverse());
    expect(getFdrColourScale('RdYlGn').isCyclical).toBe(false);
  });

  test('supports contrast-safe fill palettes and keeps font mode as the default', () => {
    expect(defaultFdrDisplayMode).toBe('font');
    const palette = getFdrFillPalette('RdYlGn', 'dark', false);

    expect(palette).toEqual(getFdrColourScale('RdYlGn').dark);
    expect(getFdrFillForeground('#000000')).toBe('#FFFFFF');
    expect(getFdrFillForeground('#FFFFFF')).toBe('#000000');
  });

  test('keeps every light and dark FDR chip label at readable contrast', () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
      return channels.reduce((total, channel, index) => {
        const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        return total + linear * [0.2126, 0.7152, 0.0722][index];
      }, 0);
    };
    const mix = (colour: string, surface: string) => {
      const channels = [0, 1, 2].map((index) => Math.round(
        Number.parseInt(colour.slice(1 + index * 2, 3 + index * 2), 16) * 0.14
        + Number.parseInt(surface.slice(1 + index * 2, 3 + index * 2), 16) * 0.86,
      ));
      return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    };

    for (const mode of ['light', 'dark'] as const) {
      const surface = mode === 'light' ? '#ffffff' : '#111c1b';
      for (const scale of fdrColourScales) {
        for (const colour of getFdrPalette(scale.name, mode, false)) {
          const colourLuminance = luminance(colour);
          const backgroundLuminance = luminance(mix(colour, surface));
          const ratio = (Math.max(colourLuminance, backgroundLuminance) + 0.05)
            / (Math.min(colourLuminance, backgroundLuminance) + 0.05);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
