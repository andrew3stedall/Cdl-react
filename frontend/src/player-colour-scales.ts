/**
 * Manager-selectable colours for player categories and numeric metrics.
 *
 * Position colours are categorical: each position always receives one
 * distinct colour. Metric colours are sequential: larger values move through
 * the same ordered low-to-high scale.
 */

export type PlayerPosition = 'GKP' | 'DEF' | 'MID' | 'FWD';
export type PositionColourScaleName = 'Classic' | 'Ocean' | 'Vibrant';
export type MetricColourScaleName = 'Blue' | 'Teal' | 'Purple' | 'Amber';
export type MetricPalette = readonly [string, string, string, string, string];

export interface PositionColourScale {
  name: PositionColourScaleName;
  label: string;
  positions: Record<PlayerPosition, string>;
}

export interface MetricColourScale {
  name: MetricColourScaleName;
  label: string;
  light: MetricPalette;
  dark: MetricPalette;
}

const positionColourScaleRows: readonly PositionColourScale[] = [
  {
    name: 'Classic',
    label: 'Classic',
    positions: { GKP: '#7C3AED', DEF: '#2563EB', MID: '#059669', FWD: '#EA580C' },
  },
  {
    name: 'Ocean',
    label: 'Ocean',
    positions: { GKP: '#4338CA', DEF: '#0284C7', MID: '#0D9488', FWD: '#C026D3' },
  },
  {
    name: 'Vibrant',
    label: 'Vibrant',
    positions: { GKP: '#9333EA', DEF: '#1D4ED8', MID: '#047857', FWD: '#C2410C' },
  },
] as const;

const metricColourScaleRows: readonly MetricColourScale[] = [
  {
    name: 'Blue',
    label: 'Blue',
    light: ['#EFF6FF', '#BFDBFE', '#60A5FA', '#2563EB', '#1E3A8A'],
    dark: ['#172554', '#1D4ED8', '#60A5FA', '#BFDBFE', '#EFF6FF'],
  },
  {
    name: 'Teal',
    label: 'Teal',
    light: ['#F0FDFA', '#99F6E4', '#2DD4BF', '#0F766E', '#134E4A'],
    dark: ['#042F2E', '#0F766E', '#2DD4BF', '#99F6E4', '#CCFBF1'],
  },
  {
    name: 'Purple',
    label: 'Purple',
    light: ['#FAF5FF', '#E9D5FF', '#C084FC', '#9333EA', '#581C87'],
    dark: ['#2E1065', '#7E22CE', '#C084FC', '#E9D5FF', '#FAF5FF'],
  },
  {
    name: 'Amber',
    label: 'Amber',
    light: ['#FFFBEB', '#FDE68A', '#FBBF24', '#D97706', '#78350F'],
    dark: ['#451A03', '#B45309', '#FBBF24', '#FDE68A', '#FEF3C7'],
  },
] as const;

export const positionColourScales = positionColourScaleRows;
export const metricColourScales = metricColourScaleRows;
export const defaultPositionColourScale: PositionColourScaleName = 'Classic';
export const defaultMetricColourScale: MetricColourScaleName = 'Blue';
export const defaultMetricColourScaleReversed = false;

export function resolvePositionColourScale(value: string | null | undefined): PositionColourScaleName {
  return positionColourScales.some((scale) => scale.name === value)
    ? value as PositionColourScaleName
    : defaultPositionColourScale;
}

export function resolveMetricColourScale(value: string | null | undefined): MetricColourScaleName {
  return metricColourScales.some((scale) => scale.name === value)
    ? value as MetricColourScaleName
    : defaultMetricColourScale;
}

export function getPositionColourScale(name: PositionColourScaleName): PositionColourScale {
  return positionColourScales.find((scale) => scale.name === name) ?? positionColourScales[0];
}

export function getMetricColourScale(name: MetricColourScaleName): MetricColourScale {
  return metricColourScales.find((scale) => scale.name === name) ?? metricColourScales[0];
}

export function getPositionColour(name: PositionColourScaleName, position: string): string {
  const normalized = normalizePosition(position);
  return getPositionColourScale(name).positions[normalized ?? 'MID'];
}

export function getMetricPalette(
  name: MetricColourScaleName,
  mode: 'light' | 'dark',
  reversed = defaultMetricColourScaleReversed,
): MetricPalette {
  const palette = [...getMetricColourScale(name)[mode]];
  if (reversed) palette.reverse();
  return palette as unknown as MetricPalette;
}

export function getMetricColour(
  name: MetricColourScaleName,
  value: number | null | undefined,
  options: { min?: number; max?: number; mode?: 'light' | 'dark'; reversed?: boolean } = {},
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const min = Number.isFinite(options.min) ? options.min as number : 0;
  const max = Number.isFinite(options.max) && (options.max as number) > min ? options.max as number : min + 1;
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const index = Math.min(4, Math.max(0, Math.round(ratio * 4)));
  return getMetricPalette(name, options.mode ?? 'light', options.reversed ?? defaultMetricColourScaleReversed)[index];
}

function normalizePosition(position: string): PlayerPosition | null {
  const normalized = position.trim().toUpperCase();
  if (normalized === 'GK' || normalized === 'GKP' || normalized === 'GOALKEEPER') return 'GKP';
  if (normalized === 'DEF' || normalized === 'DEFENDER') return 'DEF';
  if (normalized === 'MID' || normalized === 'MIDFIELDER') return 'MID';
  if (normalized === 'FWD' || normalized === 'FORWARD' || normalized === 'STRIKER') return 'FWD';
  return null;
}
