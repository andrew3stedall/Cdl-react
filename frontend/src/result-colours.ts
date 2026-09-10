export interface ResultColourPalette {
  win: string;
  draw: string;
  loss: string;
}

export interface ResultColourPreset {
  name: string;
  label: string;
  description: string;
  colours: ResultColourPalette;
}

export const defaultResultColours: ResultColourPalette = {
  win: '#22C55E',
  draw: '#F59E0B',
  loss: '#F43F5E',
};

export const resultColourPresets: ResultColourPreset[] = [
  {
    name: 'classic',
    label: 'Classic',
    description: 'Green wins, amber draws, rose losses.',
    colours: defaultResultColours,
  },
  {
    name: 'colour-safe',
    label: 'Colour-safe',
    description: 'Blue wins, gold draws, purple losses for stronger hue separation.',
    colours: {
      win: '#3B82F6',
      draw: '#F59E0B',
      loss: '#A855F7',
    },
  },
  {
    name: 'high-contrast',
    label: 'High contrast',
    description: 'Cyan wins, yellow draws, pink losses for dark surfaces.',
    colours: {
      win: '#06B6D4',
      draw: '#EAB308',
      loss: '#EC4899',
    },
  },
];

const HEX_COLOUR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function resolveColour(value: string | undefined, fallback: string): string {
  return value && HEX_COLOUR_PATTERN.test(value) ? value.toUpperCase() : fallback;
}

export function resolveResultColours(value?: Partial<ResultColourPalette> | null): ResultColourPalette {
  return {
    win: resolveColour(value?.win, defaultResultColours.win),
    draw: resolveColour(value?.draw, defaultResultColours.draw),
    loss: resolveColour(value?.loss, defaultResultColours.loss),
  };
}

export function resultColoursEqual(left: ResultColourPalette, right: ResultColourPalette): boolean {
  return left.win.toUpperCase() === right.win.toUpperCase()
    && left.draw.toUpperCase() === right.draw.toUpperCase()
    && left.loss.toUpperCase() === right.loss.toUpperCase();
}

export function getResultColourPaletteLabel(colours: ResultColourPalette): string {
  return resultColourPresets.find((preset) => resultColoursEqual(preset.colours, colours))?.label ?? 'Custom';
}
