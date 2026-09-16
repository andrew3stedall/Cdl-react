import { Check, Circle, Palette } from 'lucide-react';
import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

import { ColourPaletteSelector } from './components/ui/colour-palette-selector';
import { Card } from './components/ui/card';
import { getFdrFillForeground } from './fdr-colour-scales';
import {
  getResultColourPaletteLabel,
  resultColourPresets,
  resultColoursEqual,
  type ResultColourPalette,
} from './result-colours';

interface ResultColourSettingsProps {
  colours: ResultColourPalette;
  onChange: (colours: ResultColourPalette) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

type ResultColourKey = keyof ResultColourPalette;

interface HsvColour {
  hue: number;
  saturation: number;
  exposure: number;
}

const resultEntries = [
  { key: 'win', label: 'Win' },
  { key: 'draw', label: 'Draw' },
  { key: 'loss', label: 'Loss' },
] as const satisfies ReadonlyArray<{ key: ResultColourKey; label: string }>;

export function ResultColourSettings({ colours, onChange, saveStatus }: ResultColourSettingsProps) {
  const [selectedKey, setSelectedKey] = useState<ResultColourKey>('win');
  const selectedEntry = resultEntries.find(({ key }) => key === selectedKey) ?? resultEntries[0];
  const hsv = hexToHsv(colours[selectedKey]);

  const updateSelectedColour = (nextHsv: HsvColour) => {
    onChange({ ...colours, [selectedKey]: hsvToHex(nextHsv) });
  };

  const updateFieldFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    updateSelectedColour({
      ...hsv,
      saturation: clamp((event.clientX - bounds.left) / bounds.width),
      exposure: clamp(1 - ((event.clientY - bounds.top) / bounds.height)),
    });
  };

  const updateHueFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    updateSelectedColour({
      ...hsv,
      hue: clamp((event.clientX - bounds.left) / bounds.width) * 360,
    });
  };

  return (
    <Card className="profile-card profile-settings-card result-colour-settings">
      <div className="profile-card__header">
        <div>
          <p className="profile-card__eyebrow">Match results</p>
          <h2>Result colours</h2>
        </div>
        <Palette aria-hidden="true" className="profile-appearance-icon" size={21} />
      </div>
      <p className="result-colour-settings__intro">
        Keep win, draw, and loss states separate from the workspace accent so changing the theme never changes what a result means.
      </p>

      <div aria-label="Result colour presets" className="result-colour-settings__presets" role="group">
        {resultColourPresets.map((preset) => {
          const isSelected = resultColoursEqual(preset.colours, colours);
          return (
            <button
              aria-pressed={isSelected}
              className={`result-colour-settings__preset${isSelected ? ' is-selected' : ''}`}
              key={preset.name}
              onClick={() => onChange({ ...preset.colours })}
              type="button"
            >
              <ResultColourSwatches colours={preset.colours} />
              <span className="result-colour-settings__preset-copy">
                <strong>{preset.label}</strong>
                <small>{preset.description}</small>
              </span>
              <span aria-hidden="true" className="profile-preset-check">
                {isSelected ? <Check size={15} /> : <Circle size={15} />}
              </span>
            </button>
          );
        })}
      </div>

      <section aria-labelledby="custom-result-colours-title" className="result-colour-settings__custom">
        <div className="result-colour-settings__custom-label">
          <strong id="custom-result-colours-title">Custom palette</strong>
          <small>Choose win, draw, and loss independently. Changes are previewed and saved immediately.</small>
        </div>

        <div
          aria-label={`Colour field for result ${selectedEntry.label}`}
          className="result-colour-picker__field"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFieldFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons > 0) updateFieldFromPointer(event);
          }}
          style={{ '--picker-hue': `${hsv.hue}deg` } as CSSProperties}
        >
          <span
            aria-hidden="true"
            className="result-colour-picker__field-pointer"
            style={{ left: `${hsv.saturation * 100}%`, top: `${(1 - hsv.exposure) * 100}%` }}
          />
        </div>

        <div
          aria-label={`${selectedEntry.label} result hue selector`}
          className="result-colour-picker__hue"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateHueFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons > 0) updateHueFromPointer(event);
          }}
        >
          <span
            aria-hidden="true"
            className="result-colour-picker__hue-pointer"
            style={{ left: `${(hsv.hue / 360) * 100}%` }}
          />
        </div>

        <div className="result-colour-picker__sliders">
          <label>
            <span>Saturation <strong>{Math.round(hsv.saturation * 100)}%</strong></span>
            <input
              aria-label={`Saturation for result ${selectedEntry.label}`}
              max="100"
              min="0"
              onChange={(event) => updateSelectedColour({ ...hsv, saturation: Number(event.target.value) / 100 })}
              type="range"
              value={Math.round(hsv.saturation * 100)}
            />
          </label>
          <label>
            <span>Exposure <strong>{Math.round(hsv.exposure * 100)}%</strong></span>
            <input
              aria-label={`Exposure for result ${selectedEntry.label}`}
              max="100"
              min="0"
              onChange={(event) => updateSelectedColour({ ...hsv, exposure: Number(event.target.value) / 100 })}
              type="range"
              value={Math.round(hsv.exposure * 100)}
            />
          </label>
        </div>

        <ColourPaletteSelector
          ariaLabel="Custom result colours"
          columns={resultEntries.length}
          onSelect={(id) => setSelectedKey(id as ResultColourKey)}
          options={resultEntries.map(({ key, label }) => ({
            ariaLabel: `Edit result ${label} colour`,
            colour: colours[key],
            foregroundColor: getFdrFillForeground(colours[key]),
            id: key,
            label,
          }))}
          selectedId={selectedKey}
        />
      </section>

      <ResultColourPreview colours={colours} />
      <p aria-live="polite" className="profile-save-status" role="status">
        {saveStatus === 'saving' ? 'Saving result colours…' : null}
        {saveStatus === 'saved' ? 'Result colours saved.' : null}
        {saveStatus === 'error' ? 'Result colours could not be saved.' : null}
      </p>
    </Card>
  );
}

export function ResultColourSummaryPreview({ colours }: { colours: ResultColourPalette }) {
  return (
    <span aria-label={`${getResultColourPaletteLabel(colours)} result colour palette`} className="result-colour-summary-preview">
      {resultEntries.map(({ key }) => (
        <i aria-hidden="true" key={key} style={{ '--result-colour': colours[key] } as CSSProperties} />
      ))}
    </span>
  );
}

function ResultColourSwatches({ colours }: { colours: ResultColourPalette }) {
  return (
    <span aria-hidden="true" className="result-colour-settings__swatches">
      {resultEntries.map(({ key }) => (
        <i key={key} style={{ '--result-colour': colours[key] } as CSSProperties} />
      ))}
    </span>
  );
}

function ResultColourPreview({ colours }: { colours: ResultColourPalette }) {
  const previewScores = [
    { key: 'win', label: 'Win', points: 52 },
    { key: 'draw', label: 'Draw', points: 47 },
    { key: 'loss', label: 'Loss', points: 39 },
  ] as const;

  return (
    <div aria-label="Result colour preview" className="result-colour-preview">
      <div className="result-colour-preview__header">
        <strong>Team preview</strong>
        <small>{getResultColourPaletteLabel(colours)}</small>
      </div>
      <div className="result-colour-preview__scores">
        {previewScores.map(({ key, label, points }) => (
          <span className="result-colour-preview__score" key={key} style={{ '--result-colour': colours[key] } as CSSProperties}>
            <strong>{points}</strong>
            <span>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hexToHsv(hex: string): HsvColour {
  const values = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = values;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: max === 0 ? 0 : delta / max,
    exposure: max,
  };
}

function hsvToHex({ hue, saturation, exposure }: HsvColour): string {
  const chroma = exposure * saturation;
  const segment = ((hue % 360) + 360) % 360 / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = exposure - chroma;
  const rgb = segment < 1
    ? [chroma, secondary, 0]
    : segment < 2
      ? [secondary, chroma, 0]
      : segment < 3
        ? [0, chroma, secondary]
        : segment < 4
          ? [0, secondary, chroma]
          : segment < 5
            ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  return `#${rgb.map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
