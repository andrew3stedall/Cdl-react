import { Check, Circle, Palette } from 'lucide-react';
import type { CSSProperties } from 'react';

import { Card } from './components/ui/card';
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

const resultEntries = [
  { key: 'win', label: 'Win' },
  { key: 'draw', label: 'Draw' },
  { key: 'loss', label: 'Loss' },
] as const;

export function ResultColourSettings({ colours, onChange, saveStatus }: ResultColourSettingsProps) {
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
          <small>Choose each semantic colour independently. Changes are previewed and saved immediately.</small>
        </div>
        <div className="result-colour-settings__picker-row">
          {resultEntries.map(({ key, label }) => (
            <label className="result-colour-settings__picker" key={key}>
              <span>{label}</span>
              <input
                aria-label={`${label} result colour`}
                onChange={(event) => onChange({ ...colours, [key]: event.target.value.toUpperCase() })}
                type="color"
                value={colours[key]}
              />
              <small>{colours[key]}</small>
            </label>
          ))}
        </div>
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
        <strong>Gaffers Desk preview</strong>
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
