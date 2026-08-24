import { describe, expect, test } from 'vitest';

import {
  defaultFdrDisplayMode,
  defaultFdrCustomAnchors,
  fdrColourScales,
  getFdrFillForeground,
  getFdrFillPalette,
  getFdrPalette,
  getFdrColourScale,
  resolveFdrCustomAnchors,
} from './fdr-colour-scales';

describe('FDR colour scales', () => {
  test('keeps the requested numbered presets and custom modes as five hex steps', () => {
    expect(fdrColourScales).toHaveLength(7);
    expect(fdrColourScales.map((scale) => scale.optionNumber)).toEqual([1, 5, 8, 10, 32, 34, 36]);
    expect(fdrColourScales.every((scale) => scale.light.length === 5 && scale.dark.length === 5)).toBe(true);
    expect(fdrColourScales.flatMap((scale) => [...scale.light, ...scale.dark]).every((colour) => /^#[0-9A-F]{6}$/.test(colour))).toBe(true);
    expect(fdrColourScales.filter((scale) => scale.group === 'Cyclical').map((scale) => scale.name)).toEqual([
      'Sinebow',
    ]);
    expect(fdrColourScales.map((scale) => scale.name)).toEqual([
      'BrBG', 'RdBu', 'RdYlGn', 'Turbo', 'Sinebow', 'CustomBlueRedVibrant', 'CustomGreenPurpleVibrant',
    ]);
  });

  test('interpolates the custom D3-style scale between level 1, 3, and 5 anchors', () => {
    const anchors = { min: '#0000FF', second: '#123456', mid: '#00FF00', fourth: '#654321', max: '#FF0000' };

    expect(getFdrFillPalette('CustomHex', 'light', false, anchors)).toEqual([
      '#0000FF', '#008080', '#00FF00', '#808000', '#FF0000',
    ]);
    expect(defaultFdrCustomAnchors).toEqual({ min: '#2166AC', second: '#8CAFD2', mid: '#F7F7F7', fourth: '#D58891', max: '#B2182B' });
    expect(resolveFdrCustomAnchors({ min: 'not-a-colour' })).toEqual(defaultFdrCustomAnchors);
  });

  test('supports independently selected colours at every FDR level', () => {
    const anchors = { min: '#010203', second: '#111213', mid: '#212223', fourth: '#313233', max: '#414243' };

    expect(getFdrFillPalette('CustomAll', 'light', false, anchors)).toEqual([
      '#010203', '#111213', '#212223', '#313233', '#414243',
    ]);
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
