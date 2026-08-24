/**
 * FDR colour scales sampled at five FDR levels (1–5).
 *
 * The numbered choices intentionally retain their original option numbers so
 * existing screenshots, notes, and user preferences remain understandable.
 */

export type FdrScaleGroup = 'Diverging' | 'Sequential' | 'Cyclical' | 'Custom';
export type FdrPalette = readonly [string, string, string, string, string];
export type FdrDisplayMode = 'font' | 'fill';
export interface FdrCustomAnchors {
  min: string;
  second: string;
  mid: string;
  fourth: string;
  max: string;
}

export const defaultFdrCustomAnchors: FdrCustomAnchors = {
  min: '#2166AC',
  second: '#8CAFD2',
  mid: '#F7F7F7',
  fourth: '#D58891',
  max: '#B2182B',
};

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as Rgb;
}

function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function mixRgb(first: Rgb, second: Rgb, firstWeight: number): Rgb {
  return first.map((channel, index) => channel * firstWeight + second[index] * (1 - firstWeight)) as Rgb;
}

function interpolateRgb(first: string, second: string, t: number): string {
  return rgbToHex(mixRgb(hexToRgb(first), hexToRgb(second), 1 - t));
}

function interpolateThreeColourAnchors(anchors: readonly [string, string, string]): FdrPalette {
  return [
    anchors[0].toUpperCase(),
    interpolateRgb(anchors[0], anchors[1], 0.5),
    anchors[1].toUpperCase(),
    interpolateRgb(anchors[1], anchors[2], 0.5),
    anchors[2].toUpperCase(),
  ];
}

export function resolveFdrCustomAnchors(value: Partial<FdrCustomAnchors> | null | undefined): FdrCustomAnchors {
  const resolve = (candidate: string | undefined, fallback: string): string => (
    candidate && /^#[0-9A-Fa-f]{6}$/.test(candidate) ? candidate.toUpperCase() : fallback
  );

  return {
    min: resolve(value?.min, defaultFdrCustomAnchors.min),
    second: resolve(value?.second, defaultFdrCustomAnchors.second),
    mid: resolve(value?.mid, defaultFdrCustomAnchors.mid),
    fourth: resolve(value?.fourth, defaultFdrCustomAnchors.fourth),
    max: resolve(value?.max, defaultFdrCustomAnchors.max),
  };
}

function buildThreeColourScale<const TName extends string>(
  name: TName,
  label: string,
  lightAnchors: readonly [string, string, string],
  darkAnchors: readonly [string, string, string],
) {
  return {
    name,
    label,
    group: 'Custom' as const,
    isCyclical: false as const,
    optionNumber: null,
    light: interpolateThreeColourAnchors(lightAnchors),
    dark: interpolateThreeColourAnchors(darkAnchors),
  } as const;
}

const fdrScaleRows = [
  { name: 'BrBG', label: 'Brown–Blue–Green', group: 'Diverging', isCyclical: false, optionNumber: 1, light: ['#543005', '#946D2B', '#687951', '#3B7E77', '#003C30'], dark: ['#B6680B', '#CEA156', '#EEF1EA', '#5BB2A8', '#008C70'] },
  { name: 'RdBu', label: 'Red–Blue', group: 'Diverging', isCyclical: false, optionNumber: 5, light: ['#67001F', '#CB4724', '#866E67', '#337AA2', '#053061'], dark: ['#F4004A', '#E48268', '#F2EFEE', '#6BACD0', '#0C78F2'] },
  { name: 'RdYlGn', label: 'Red–Yellow–Green', group: 'Diverging', isCyclical: false, optionNumber: 8, light: ['#A50026', '#C74C08', '#7A7709', '#46812C', '#006837'], dark: ['#F60039', '#F88D52', '#F9F7AE', '#85CB67', '#008E4B'] },
  { name: 'Turbo', label: 'Turbo', group: 'Sequential', isCyclical: false, optionNumber: 10, light: ['#23171B', '#157E98', '#378403', '#BD5500', '#900C00'], dark: ['#9F6D7E', '#26BCE1', '#95FB51', '#FF821D', '#F41400'] },
  { name: 'Sinebow', label: 'Sinebow', group: 'Cyclical', isCyclical: true, optionNumber: 32, light: ['#E90000', '#727900', '#018710', '#017E98', '#582AFC'], dark: ['#FF4040', '#B9C500', '#35FE4C', '#02ADD0', '#815EFD'] },
  { name: 'CustomBlueRedVibrant', label: 'Blue–Red vibrant', group: 'Custom', isCyclical: false, optionNumber: 34, light: ['#2166AC', '#8CAFD2', '#F7F7F7', '#D58891', '#B2182B'], dark: ['#67B7E1', '#AFE0F1', '#F7F7F7', '#F5A2A2', '#F06B6B'] },
  { name: 'CustomGreenPurpleVibrant', label: 'Green–Purple vibrant', group: 'Custom', isCyclical: false, optionNumber: 36, light: ['#1B9E77', '#8CCBB5', '#F7F7F7', '#C58CDA', '#984EA3'], dark: ['#5FD3A8', '#ABEDD3', '#F7F7F7', '#E0A5EF', '#D17BE0'] },
] as const;

const customFdrScaleRows = [
  buildThreeColourScale('CustomHex', 'Custom 1 / 3 / 5', [defaultFdrCustomAnchors.min, defaultFdrCustomAnchors.mid, defaultFdrCustomAnchors.max], [defaultFdrCustomAnchors.min, defaultFdrCustomAnchors.mid, defaultFdrCustomAnchors.max]),
  {
    name: 'CustomAll',
    label: 'Custom every colour',
    group: 'Custom' as const,
    isCyclical: false as const,
    optionNumber: null,
    light: [defaultFdrCustomAnchors.min, defaultFdrCustomAnchors.second, defaultFdrCustomAnchors.mid, defaultFdrCustomAnchors.fourth, defaultFdrCustomAnchors.max],
    dark: [defaultFdrCustomAnchors.min, defaultFdrCustomAnchors.second, defaultFdrCustomAnchors.mid, defaultFdrCustomAnchors.fourth, defaultFdrCustomAnchors.max],
  },
] as const;

export type FdrScaleName = (typeof fdrScaleRows)[number]['name'] | (typeof customFdrScaleRows)[number]['name'];
export type FdrColourScale = (typeof fdrScaleRows)[number] | (typeof customFdrScaleRows)[number];

export const fdrColourScales: readonly FdrColourScale[] = fdrScaleRows;
export const fdrCustomColourScales: readonly FdrColourScale[] = customFdrScaleRows;
export const defaultFdrScaleName: FdrScaleName = 'RdYlGn';
export const defaultFdrScaleReversed = true;
export const defaultFdrDisplayMode: FdrDisplayMode = 'font';

const fdrContrastTarget = 4.6;
const fdrTintStrength = 0.14;
const fdrThemeSurface = {
  dark: '#111c1b',
  light: '#ffffff',
} as const;

function relativeLuminance(rgb: Rgb): number {
  return rgb.reduce((total, channel, index) => {
    const normalized = channel / 255;
    const linear = normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    return total + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function contrastRatio(first: Rgb, second: Rgb): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function adjustForFdrChipContrast(hex: string, mode: 'light' | 'dark'): string {
  const original = hexToRgb(hex);
  const surface = hexToRgb(fdrThemeSurface[mode]);
  const background = mixRgb(original, surface, fdrTintStrength);
  if (contrastRatio(original, background) >= fdrContrastTarget) return hex;

  const target = mode === 'light' ? [0, 0, 0] as Rgb : [255, 255, 255] as Rgb;
  for (let step = 1; step <= 256; step += 1) {
    const candidate = mixRgb(original, target, 1 - step / 256);
    const candidateBackground = mixRgb(candidate, surface, fdrTintStrength);
    if (contrastRatio(candidate, candidateBackground) >= fdrContrastTarget) {
      return rgbToHex(candidate);
    }
  }

  return rgbToHex(target);
}

function allFdrScales(): readonly FdrColourScale[] {
  return [...fdrColourScales, ...fdrCustomColourScales];
}

export function resolveFdrScaleName(name: string | null | undefined): FdrScaleName {
  return allFdrScales().some((scale) => scale.name === name)
    ? name as FdrScaleName
    : defaultFdrScaleName;
}

export function getFdrColourScale(name: FdrScaleName): FdrColourScale {
  return allFdrScales().find((scale) => scale.name === name) ?? fdrColourScales[0];
}

export function getFdrPalette(
  name: FdrScaleName,
  mode: 'light' | 'dark',
  reversed: boolean,
  customAnchors: FdrCustomAnchors = defaultFdrCustomAnchors,
): FdrPalette {
  const sourcePalette = name === 'CustomHex'
    ? interpolateThreeColourAnchors([customAnchors.min, customAnchors.mid, customAnchors.max])
    : name === 'CustomAll'
      ? [customAnchors.min, customAnchors.second, customAnchors.mid, customAnchors.fourth, customAnchors.max]
      : getFdrColourScale(name)[mode];
  const palette = sourcePalette.map((colour) => adjustForFdrChipContrast(colour, mode));
  if (reversed) palette.reverse();
  return palette as unknown as FdrPalette;
}

export function getFdrFillPalette(
  name: FdrScaleName,
  mode: 'light' | 'dark',
  reversed: boolean,
  customAnchors: FdrCustomAnchors = defaultFdrCustomAnchors,
): FdrPalette {
  const palette = name === 'CustomHex'
    ? [...interpolateThreeColourAnchors([customAnchors.min, customAnchors.mid, customAnchors.max])]
    : name === 'CustomAll'
      ? [customAnchors.min, customAnchors.second, customAnchors.mid, customAnchors.fourth, customAnchors.max]
      : [...getFdrColourScale(name)[mode]];
  if (reversed) palette.reverse();
  return palette as unknown as FdrPalette;
}

export function getFdrFillForeground(colour: string): '#000000' | '#FFFFFF' {
  const background = hexToRgb(colour);
  const blackContrast = contrastRatio(background, [0, 0, 0]);
  const whiteContrast = contrastRatio(background, [255, 255, 255]);
  return blackContrast >= whiteContrast ? '#000000' : '#FFFFFF';
}
