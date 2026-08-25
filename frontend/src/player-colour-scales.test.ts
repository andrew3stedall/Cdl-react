import { describe, expect, test } from 'vitest';

import {
  getMetricColour,
  getMetricPalette,
  getPositionColour,
  resolveMetricColourScale,
  resolvePositionColourScale,
} from './player-colour-scales';

describe('player colour scales', () => {
  test('keeps position colours categorical and stable for each position', () => {
    const colours = ['GKP', 'DEF', 'MID', 'FWD'].map((position) => getPositionColour('Classic', position));

    expect(new Set(colours).size).toBe(4);
    expect(getPositionColour('Classic', 'Goalkeeper')).toBe(colours[0]);
    expect(getPositionColour('Classic', 'unknown')).toBe(colours[2]);
  });

  test('returns ordered metric colours and supports reversing them', () => {
    const palette = getMetricPalette('Blue', 'light');
    const reversed = getMetricPalette('Blue', 'light', true);

    expect(palette).toHaveLength(5);
    expect(palette[0]).toBe(reversed[4]);
    expect(palette[4]).toBe(reversed[0]);
    expect(getMetricColour('Blue', 0, { min: 0, max: 100 })).toBe(palette[0]);
    expect(getMetricColour('Blue', 100, { min: 0, max: 100 })).toBe(palette[4]);
  });

  test('falls back safely for unknown saved scale names', () => {
    expect(resolvePositionColourScale('missing')).toBe('Classic');
    expect(resolveMetricColourScale('missing')).toBe('Blue');
    expect(getMetricColour('Blue', null)).toBeNull();
  });
});
