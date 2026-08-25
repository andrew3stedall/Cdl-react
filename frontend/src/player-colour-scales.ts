/**
 * Manager-selectable colours for player categories and numeric metrics.
 *
 * Position colours are categorical: each position always receives one
 * distinct colour. Metric colours are sequential: larger values move through
 * the same ordered low-to-high scale.
 */

export type PlayerPosition = 'GKP' | 'DEF' | 'MID' | 'FWD';
export type PositionColourScaleName = 'Classic' | 'Ocean' | 'Vibrant' | 'Custom';
export type MetricColourScaleName = 'Blue' | 'Teal' | 'Purple' | 'Amber' | 'Custom';
export type PositionColourMode = 'name-font' | 'name-fill' | 'card-border' | 'card-fill';
export type MetricPalette = readonly [string, string, string, string, string];
export type PositionPalette = Record<PlayerPosition, string>;

export interface PlayerColourPalette {
  id: string;
  name: string;
  family: 'position' | 'metric';
  colours: string[];
}

export interface PositionColourScale {
  name: PositionColourScaleName;
  label: string;
  description: string;
  positions: Record<PlayerPosition, string>;
}

export interface MetricColourScale {
  name: MetricColourScaleName;
  label: string;
  description: string;
  light: MetricPalette;
  dark: MetricPalette;
}

const positionColourScaleRows: readonly PositionColourScale[] = [
  {
    name: 'Classic',
    label: 'Classic',
    description: 'Clear, high-contrast colours for each position.',
    positions: { GKP: '#7C3AED', DEF: '#2563EB', MID: '#059669', FWD: '#EA580C' },
  },
  {
    name: 'Ocean',
    label: 'Ocean',
    description: 'Cooler blues, teals, and violet accents.',
    positions: { GKP: '#4338CA', DEF: '#0284C7', MID: '#0D9488', FWD: '#C026D3' },
  },
  {
    name: 'Vibrant',
    label: 'Vibrant',
    description: 'Stronger, brighter separation between positions.',
    positions: { GKP: '#9333EA', DEF: '#1D4ED8', MID: '#047857', FWD: '#C2410C' },
  },
] as const;

const metricColourScaleRows: readonly MetricColourScale[] = [
  {
    name: 'Blue',
    label: 'Blue',
    description: 'Blue through teal, yellow, orange, and red.',
    light: ['#2563EB', '#0EA5A4', '#A3C635', '#F59E0B', '#DC2626'],
    dark: ['#60A5FA', '#2DD4BF', '#BEF264', '#FBBF24', '#F87171'],
  },
  {
    name: 'Teal',
    label: 'Teal',
    description: 'Teal through lime, amber, and crimson.',
    light: ['#0F766E', '#14B8A6', '#84CC16', '#F59E0B', '#B91C1C'],
    dark: ['#5EEAD4', '#2DD4BF', '#BEF264', '#FBBF24', '#F87171'],
  },
  {
    name: 'Purple',
    label: 'Purple',
    description: 'Indigo through violet and magenta to red.',
    light: ['#4338CA', '#7C3AED', '#C026D3', '#EA580C', '#B91C1C'],
    dark: ['#818CF8', '#A78BFA', '#E879F9', '#FB923C', '#F87171'],
  },
  {
    name: 'Amber',
    label: 'Amber',
    description: 'Deep blue through cyan, teal, amber, and red.',
    light: ['#1D4ED8', '#0284C7', '#0D9488', '#F59E0B', '#991B1B'],
    dark: ['#60A5FA', '#38BDF8', '#2DD4BF', '#FBBF24', '#F87171'],
  },
] as const;

export const positionColourScales = positionColourScaleRows;
export const metricColourScales = metricColourScaleRows;
export const defaultPositionColourScale: PositionColourScaleName = 'Classic';
export const defaultMetricColourScale: MetricColourScaleName = 'Blue';
export const defaultMetricColourScaleReversed = false;
export const defaultPositionColourMode: PositionColourMode = 'name-font';
export const defaultPositionCustomColours: PositionPalette = getPositionColourScale('Classic').positions;
export const defaultMetricCustomColours: MetricPalette = getMetricColourScale('Blue').light;

export const positionColourModes: readonly { name: PositionColourMode; label: string; description: string }[] = [
  { name: 'name-font', label: 'Player name font colour', description: 'Colour the player name text.' },
  { name: 'name-fill', label: 'Player name fill colour', description: 'Use the position colour behind the player name.' },
  { name: 'card-border', label: 'Player card circle border', description: 'Outline the reusable player card circle.' },
  { name: 'card-fill', label: 'Player card circle fill', description: 'Tint the reusable player card circle.' },
] as const;

export function resolvePositionColourScale(value: string | null | undefined): PositionColourScaleName {
  return positionColourScales.some((scale) => scale.name === value)
    ? value as PositionColourScaleName
    : defaultPositionColourScale;
}

export function resolvePositionColourMode(value: string | null | undefined): PositionColourMode {
  return positionColourModes.some((mode) => mode.name === value) ? value as PositionColourMode : defaultPositionColourMode;
}

export function resolveMetricColourScale(value: string | null | undefined): MetricColourScaleName {
  return metricColourScales.some((scale) => scale.name === value)
    ? value as MetricColourScaleName
    : defaultMetricColourScale;
}

export function getPositionColourScale(name: PositionColourScaleName): PositionColourScale {
  return positionColourScales.find((scale) => scale.name === name) ?? positionColourScales[0];
}

export function getCustomPositionColourScale(colours: Partial<PositionPalette> | null | undefined): PositionColourScale {
  return {
    name: 'Custom',
    label: 'Custom',
    description: 'Your saved four-position colour palette.',
    positions: resolvePositionPalette(colours),
  };
}

export function getMetricColourScale(name: MetricColourScaleName): MetricColourScale {
  return metricColourScales.find((scale) => scale.name === name) ?? metricColourScales[0];
}

export function getCustomMetricColourScale(colours: MetricPalette | null | undefined): MetricColourScale {
  const palette = resolveMetricPalette(colours);
  return {
    name: 'Custom',
    label: 'Custom',
    description: 'Your saved five-step heatmap colour palette.',
    light: palette,
    dark: palette,
  };
}

export function getPositionColour(name: PositionColourScaleName, position: string, customColours?: Partial<PositionPalette>): string {
  const normalized = normalizePosition(position);
  const palette = name === 'Custom' ? getCustomPositionColourScale(customColours) : getPositionColourScale(name);
  return palette.positions[normalized ?? 'MID'];
}

export function getMetricPalette(
  name: MetricColourScaleName,
  mode: 'light' | 'dark',
  reversed = defaultMetricColourScaleReversed,
  customColours?: MetricPalette,
): MetricPalette {
  const palette = [...(name === 'Custom' ? getCustomMetricColourScale(customColours)[mode] : getMetricColourScale(name)[mode])];
  if (reversed) palette.reverse();
  return palette as unknown as MetricPalette;
}

export function getMetricColour(
  name: MetricColourScaleName,
  value: number | null | undefined,
  options: { min?: number; max?: number; mode?: 'light' | 'dark'; reversed?: boolean; customColours?: MetricPalette } = {},
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const min = Number.isFinite(options.min) ? options.min as number : 0;
  const max = Number.isFinite(options.max) && (options.max as number) > min ? options.max as number : min + 1;
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const index = Math.min(4, Math.max(0, Math.round(ratio * 4)));
  return getMetricPalette(name, options.mode ?? 'light', options.reversed ?? defaultMetricColourScaleReversed, options.customColours)[index];
}

export function resolvePositionPalette(colours: Partial<PositionPalette> | null | undefined): PositionPalette {
  const fallback = getPositionColourScale('Classic').positions;
  return {
    GKP: resolveHexColour(colours?.GKP, fallback.GKP),
    DEF: resolveHexColour(colours?.DEF, fallback.DEF),
    MID: resolveHexColour(colours?.MID, fallback.MID),
    FWD: resolveHexColour(colours?.FWD, fallback.FWD),
  };
}

export function resolveMetricPalette(colours: readonly string[] | null | undefined): MetricPalette {
  const fallback = getMetricColourScale('Blue').light;
  return [0, 1, 2, 3, 4].map((index) => resolveHexColour(colours?.[index], fallback[index])) as unknown as MetricPalette;
}

export function paletteColoursForPositionScale(name: PositionColourScaleName, customColours?: Partial<PositionPalette>): string[] {
  const palette = name === 'Custom' ? getCustomPositionColourScale(customColours).positions : getPositionColourScale(name).positions;
  return ['GKP', 'DEF', 'MID', 'FWD'].map((position) => palette[position as PlayerPosition]);
}

export function paletteColoursForMetricScale(name: MetricColourScaleName, mode: 'light' | 'dark', reversed: boolean, customColours?: MetricPalette): string[] {
  return [...getMetricPalette(name, mode, reversed, customColours)];
}

function resolveHexColour(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : fallback;
}

function normalizePosition(position: string): PlayerPosition | null {
  const normalized = position.trim().toUpperCase();
  if (normalized === 'GK' || normalized === 'GKP' || normalized === 'GOALKEEPER') return 'GKP';
  if (normalized === 'DEF' || normalized === 'DEFENDER') return 'DEF';
  if (normalized === 'MID' || normalized === 'MIDFIELDER') return 'MID';
  if (normalized === 'FWD' || normalized === 'FORWARD' || normalized === 'STRIKER') return 'FWD';
  return null;
}
