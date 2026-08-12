/**
 * FDR colour scales derived from d3-scale-chromatic 3.1.0 continuous
 * interpolators. Each scale is sampled at five FDR levels (1–5).
 *
 * The light and dark values are deliberately separate. Display values are
 * adjusted towards black or white when the tinted FDR chip background would
 * otherwise make the label too faint. Cyclical scales sample t from 0 to 0.7
 * so the scale does not complete a full colour cycle.
 */

export type FdrScaleGroup = 'Diverging' | 'Sequential' | 'Cyclical';
export type FdrPalette = readonly [string, string, string, string, string];

const fdrScaleRows = [
  { name: 'BrBG', label: 'Brown–Blue–Green', group: 'Diverging', isCyclical: false, light: ['#543005', '#946D2B', '#687951', '#3B7E77', '#003C30'], dark: ['#B6680B', '#CEA156', '#EEF1EA', '#5BB2A8', '#008C70'] },
  { name: 'PRGn', label: 'Purple–Green', group: 'Diverging', isCyclical: false, light: ['#40004B', '#9161A6', '#6E766E', '#3C823D', '#00441B'], dark: ['#CF00F3', '#AE8ABD', '#EFF0EF', '#80C481', '#008F39'] },
  { name: 'PiYG', label: 'Pink–Yellow–Green', group: 'Diverging', isCyclical: false, light: ['#8E0152', '#D02F8A', '#827251', '#557F28', '#276419'], dark: ['#ED0289', '#E795C3', '#F5F3EF', '#9BCE64', '#378C23'] },
  { name: 'PuOr', label: 'Purple–Orange', group: 'Diverging', isCyclical: false, light: ['#2D004B', '#796AAB', '#8F6D52', '#A9620F', '#7F3B08'], dark: ['#B13CFF', '#998EBF', '#F3EEEA', '#EE9D3D', '#C75C0D'] },
  { name: 'RdBu', label: 'Red–Blue', group: 'Diverging', isCyclical: false, light: ['#67001F', '#CB4724', '#866E67', '#337AA2', '#053061'], dark: ['#F4004A', '#E48268', '#F2EFEE', '#6BACD0', '#0C78F2'] },
  { name: 'RdGy', label: 'Red–Grey', group: 'Diverging', isCyclical: false, light: ['#67001F', '#CB4724', '#A9613C', '#737373', '#1A1A1A'], dark: ['#F4004A', '#E48268', '#FAF4F1', '#A0A0A0', '#7B7B7B'] },
  { name: 'RdYlBu', label: 'Red–Yellow–Blue', group: 'Diverging', isCyclical: false, light: ['#A50026', '#C74C08', '#7B770A', '#327AA2', '#313695'], dark: ['#F60039', '#F88D52', '#FAF8C1', '#90C2DD', '#6D72CF'] },
  { name: 'RdYlGn', label: 'Red–Yellow–Green', group: 'Diverging', isCyclical: false, light: ['#A50026', '#C74C08', '#7A7709', '#46812C', '#006837'], dark: ['#F60039', '#F88D52', '#F9F7AE', '#85CB67', '#008E4B'] },
  { name: 'Spectral', label: 'Spectral', group: 'Diverging', isCyclical: false, light: ['#9E0142', '#C74C08', '#7B7606', '#358254', '#5E4FA2'], dark: ['#F20265', '#F88E53', '#FBF8B0', '#89CFA5', '#7E71BA'] },
  { name: 'Blues', label: 'Blues', group: 'Sequential', isCyclical: false, light: ['#0071E2', '#3278B0', '#307AA6', '#2271B4', '#08306B'], dark: ['#F7FBFF', '#C3DBEE', '#6DAED5', '#267FCA', '#2677EF'] },
  { name: 'Greens', label: 'Greens', group: 'Sequential', isCyclical: false, light: ['#418227', '#3D832F', '#38833D', '#208442', '#00441B'], dark: ['#F7FCF5', '#C6E8BF', '#73C378', '#228D46', '#008F39'] },
  { name: 'Greys', label: 'Greys', group: 'Sequential', isCyclical: false, light: ['#737373', '#737373', '#737373', '#505050', '#000000'], dark: ['#FFFFFF', '#D8D8D8', '#979797', '#7B7B7B', '#7B7B7B'] },
  { name: 'Oranges', label: 'Oranges', group: 'Sequential', isCyclical: false, light: ['#B55B00', '#B55B04', '#BF5304', '#CB4804', '#7F2704'], dark: ['#FFF5EB', '#FDCEA0', '#FB8D3D', '#D84C04', '#DF4407'] },
  { name: 'Purples', label: 'Purples', group: 'Sequential', isCyclical: false, light: ['#8962B1', '#706CB0', '#706CB0', '#6A51A4', '#3F007D'], dark: ['#FCFBFD', '#D9D8EA', '#9E9BC9', '#856FB8', '#A448FF'] },
  { name: 'Reds', label: 'Reds', group: 'Sequential', isCyclical: false, light: ['#CE4500', '#D23F07', '#DE2B07', '#CB1C1E', '#67000D'], dark: ['#FFF5F0', '#FCBAA1', '#F9694C', '#E43A3C', '#F7001F'] },
  { name: 'Turbo', label: 'Turbo', group: 'Sequential', isCyclical: false, light: ['#23171B', '#157E98', '#378403', '#BD5500', '#900C00'], dark: ['#9F6D7E', '#26BCE1', '#95FB51', '#FF821D', '#F41400'] },
  { name: 'Viridis', label: 'Viridis', group: 'Sequential', isCyclical: false, light: ['#440154', '#3B528B', '#1D817C', '#2C8430', '#827401'], dark: ['#CB03FB', '#5F79BB', '#21918C', '#5EC962', '#FDE725'] },
  { name: 'Inferno', label: 'Inferno', group: 'Sequential', isCyclical: false, light: ['#000004', '#57106E', '#BC3754', '#AC6104', '#757800'], dark: ['#6767FF', '#BB40E3', '#CC516C', '#F98E09', '#FCFFA4'] },
  { name: 'Magma', label: 'Magma', group: 'Sequential', isCyclical: false, light: ['#000004', '#51127C', '#B73779', '#D63A04', '#767804'], dark: ['#6767FF', '#A950E6', '#CA4D8D', '#FC8961', '#FCFDBF'] },
  { name: 'Plasma', label: 'Plasma', group: 'Sequential', isCyclical: false, light: ['#0D0887', '#7E03A8', '#CA3F72', '#B85907', '#747903'], dark: ['#6D68F6', '#C422FB', '#CE4D7C', '#F89540', '#F0F921'] },
  { name: 'Cividis', label: 'Cividis', group: 'Sequential', isCyclical: false, light: ['#002051', '#3C4D6E', '#76736D', '#7F743D', '#827401'], dark: ['#1874FF', '#637BAA', '#7F7C75', '#BBAF71', '#FDEA45'] },
  { name: 'Warm', label: 'Warm', group: 'Sequential', isCyclical: false, light: ['#6E40AA', '#CB2F9E', '#E90007', '#9F680C', '#4E810C'], dark: ['#9067C6', '#D23EA7', '#FF5E63', '#EFA72F', '#AFF05B'] },
  { name: 'Cool', label: 'Cool', group: 'Sequential', isCyclical: false, light: ['#6E40AA', '#2E70DD', '#11817E', '#08862C', '#4E810C'], dark: ['#9067C6', '#417DE0', '#1AC7C2', '#40F373', '#AFF05B'] },
  { name: 'CubehelixDefault', label: 'Cubehelix default', group: 'Sequential', isCyclical: false, light: ['#000000', '#16534C', '#906D42', '#855AD8', '#737373'], dark: ['#7B7B7B', '#24897E', '#A07949', '#C7B3ED', '#FFFFFF'] },
  { name: 'BuGn', label: 'Blue–Green', group: 'Sequential', isCyclical: false, light: ['#247E90', '#318072', '#348166', '#208445', '#00441B'], dark: ['#F7FCFD', '#C8EAE4', '#68C2A3', '#228D49', '#008F39'] },
  { name: 'BuPu', label: 'Blue–Purple', group: 'Sequential', isCyclical: false, light: ['#247E90', '#4277AA', '#666FB1', '#88409B', '#4D004B'], dark: ['#F7FCFD', '#BFD3E6', '#8F95C6', '#A85DBC', '#DB00D5'] },
  { name: 'GnBu', label: 'Green–Blue', group: 'Sequential', isCyclical: false, light: ['#557F19', '#378330', '#327F79', '#257BA6', '#084081'], dark: ['#F7FCF0', '#C9EAC6', '#7BCBC4', '#2B8DBF', '#1078F0'] },
  { name: 'OrRd', label: 'Orange–Red', group: 'Sequential', isCyclical: false, light: ['#AA6200', '#AD6004', '#CE4506', '#D53121', '#7F0000'], dark: ['#FFF7EC', '#FDD3A1', '#FA8E5D', '#DF4232', '#F70000'] },
  { name: 'PuBuGn', label: 'Purple–Blue–Green', group: 'Sequential', isCyclical: false, light: ['#E20071', '#656FB1', '#357AA5', '#0B808B', '#014636'], dark: ['#FFF7FB', '#CED1E6', '#69A8CF', '#0C8894', '#028C6C'] },
  { name: 'PuBu', label: 'Purple–Blue', group: 'Sequential', isCyclical: false, light: ['#E20071', '#656FB1', '#3979A7', '#0D72AD', '#023858'], dark: ['#FFF7FB', '#CED1E6', '#72A8CF', '#0F81C4', '#0580CA'] },
  { name: 'PuRd', label: 'Purple–Red', group: 'Sequential', isCyclical: false, light: ['#8D62A9', '#9B5BA7', '#D02D91', '#C9135C', '#67001F'], dark: ['#F7F4F9', '#D5BADA', '#DD63AE', '#EA2172', '#F4004A'] },
  { name: 'RdPu', label: 'Red–Purple', group: 'Sequential', isCyclical: false, light: ['#CE4500', '#E70C0C', '#E01269', '#AD0A81', '#49006A'], dark: ['#FFF7F3', '#FCC3C3', '#F369A3', '#E50DAA', '#BD2BFF'] },
  { name: 'YlGnBu', label: 'Yellow–Green–Blue', group: 'Sequential', isCyclical: false, light: ['#787800', '#3F822A', '#2D7E88', '#2260A9', '#081D58'], dark: ['#FFFFD9', '#C1E7B5', '#45B4C2', '#307CD5', '#4773EE'] },
  { name: 'YlGn', label: 'Yellow–Green', group: 'Sequential', isCyclical: false, light: ['#787800', '#5D7E16', '#388338', '#228444', '#004529'], dark: ['#FFFFE5', '#D7EFA3', '#78C578', '#248D48', '#008D54'] },
  { name: 'YlOrBr', label: 'Yellow–Orange–Brown', group: 'Sequential', isCyclical: false, light: ['#787800', '#936E01', '#B05E03', '#C64D05', '#662506'], dark: ['#FFFFE5', '#FEE18D', '#FB992C', '#D35205', '#D64E0D'] },
  { name: 'YlOrRd', label: 'Yellow–Orange–Red', group: 'Sequential', isCyclical: false, light: ['#787800', '#986C01', '#C44F02', '#E11E20', '#800026'], dark: ['#FFFFCC', '#FED676', '#FD893C', '#E5393B', '#F50049'] },
  { name: 'Rainbow', label: 'Rainbow', group: 'Cyclical', isCyclical: true, light: ['#6E40AA', '#E0106B', '#B55B04', '#3B8309', '#118360'], dark: ['#9067C6', '#F24591', '#FB9633', '#97F357', '#1DDFA3'] },
  { name: 'Sinebow', label: 'Sinebow', group: 'Cyclical', isCyclical: true, light: ['#E90000', '#727900', '#018710', '#017E98', '#582AFC'], dark: ['#FF4040', '#B9C500', '#35FE4C', '#02ADD0', '#815EFD'] },
] as const;

export type FdrScaleName = (typeof fdrScaleRows)[number]['name'];
export type FdrColourScale = (typeof fdrScaleRows)[number];

export const fdrColourScales: readonly FdrColourScale[] = fdrScaleRows;
export const defaultFdrScaleName: FdrScaleName = 'RdYlGn';
export const defaultFdrScaleReversed = true;

const fdrContrastTarget = 4.6;
const fdrTintStrength = 0.14;
const fdrThemeSurface = {
  dark: '#111c1b',
  light: '#ffffff',
} as const;

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

export function resolveFdrScaleName(name: string | null | undefined): FdrScaleName {
  return fdrColourScales.some((scale) => scale.name === name)
    ? name as FdrScaleName
    : defaultFdrScaleName;
}

export function getFdrColourScale(name: FdrScaleName): FdrColourScale {
  return fdrColourScales.find((scale) => scale.name === name) ?? fdrColourScales[0];
}

export function getFdrPalette(
  name: FdrScaleName,
  mode: 'light' | 'dark',
  reversed: boolean,
): FdrPalette {
  const palette = getFdrColourScale(name)[mode].map((colour) => adjustForFdrChipContrast(colour, mode));
  if (reversed) palette.reverse();
  return palette as unknown as FdrPalette;
}
