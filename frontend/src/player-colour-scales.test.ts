import { describe, expect, test } from 'vitest';

import {
  getMetricColour,
  getMetricPalette,
  getCustomMetricColourScale,
  getCustomPositionColourScale,
  getPositionColour,
  resolveMetricColourScale,
  resolvePositionColourMode,
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
    expect(new Set(palette).size).toBe(5);
    expect(palette[0]).not.toBe(palette[1]);
    expect(palette[1]).not.toBe(palette[2]);
  });

  test('uses custom colours for both categorical and heatmap families', () => {
    const position = getCustomPositionColourScale({ GKP: '#111111', DEF: '#222222', MID: '#333333', FWD: '#444444' });
    const metric = getCustomMetricColourScale(['#111111', '#222222', '#333333', '#444444', '#555555']);

    expect(position.positions).toEqual({ GKP: '#111111', DEF: '#222222', MID: '#333333', FWD: '#444444' });
    expect(metric.light).toEqual(['#111111', '#222222', '#333333', '#444444', '#555555']);
    expect(resolvePositionColourMode('card-fill')).toBe('card-fill');
  });

  test('falls back safely for unknown saved scale names', () => {
    expect(resolvePositionColourScale('missing')).toBe('Classic');
    expect(resolveMetricColourScale('missing')).toBe('Blue');
    expect(getMetricColour('Blue', null)).toBeNull();
  });
});
