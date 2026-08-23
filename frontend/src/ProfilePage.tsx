import type { CSSProperties } from 'react';
import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Circle,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  Type,
  PaintBucket,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Sheet } from './components/ui/sheet';
import type { AttackDirection, SessionState, ThemePreset } from './contracts';
import {
  fdrColourScales,
  getFdrFillForeground,
  getFdrFillPalette,
  getFdrPalette,
  getFdrColourScale,
  type FdrColourScale,
  type FdrDisplayMode,
} from './fdr-colour-scales';
import { getThemeMode, themePresets } from './theme-presets';
import { useThemePreset } from './theme-preset-provider';
import { themeColourOptions, type ThemeColourMode } from './theme-colours';
import './profile-page.css';

interface ProfilePageProps {
  onRefresh: () => void;
  onSignOut: () => void;
  session: SessionState;
}

export function ProfilePage({ onRefresh, onSignOut, session }: ProfilePageProps) {
  const {
    attackDirection,
    fdrDisplayMode,
    fdrScale,
    fdrScaleReversed,
    lightThemeColour,
    darkThemeColour,
    preset,
    saveStatus,
    setAttackDirection,
    setFdrDisplayMode,
    setFdrScale,
    setFdrScaleReversed,
    setThemeColour,
    setPresetName,
  } = useThemePreset();
  const [isFdrScaleSheetOpen, setIsFdrScaleSheetOpen] = useState(false);
  const user = session.user;
  const selectedFdrScale = getFdrColourScale(fdrScale);
  const selectedFdrScaleNumber = getFdrScaleOptionNumber(fdrScale);
  const themeMode = getThemeMode(preset);
  const displayName = user?.displayName ?? 'Authenticated user';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CD';

  return (
    <main aria-labelledby="account-title" className="feature-screen profile-page">
      <header className="profile-page__header">
        <p className="eyebrow">Account</p>
        <h1 id="account-title">Account</h1>
        <p>Manage your identity, workspace appearance, pitch orientation, data, and session.</p>
      </header>

      <div className="profile-page__grid">
        <Card className="profile-card profile-identity-card">
          <div className="profile-identity">
            <span aria-hidden="true" className="profile-avatar">{initials}</span>
            <div>
              <p className="profile-card__eyebrow">Manager account</p>
              <h2>{displayName}</h2>
              <p>{user?.email ?? 'No email address available'}</p>
            </div>
          </div>
          <dl className="profile-details">
            <div>
              <dt>Role</dt>
              <dd>{user?.roles.join(', ') || 'Manager'}</dd>
            </div>
            <div>
              <dt>Account ID</dt>
              <dd>{user?.id ?? 'Unavailable'}</dd>
            </div>
          </dl>
        </Card>

        <Card className="profile-card profile-appearance-card">
          <div className="profile-card__header">
            <div>
              <p className="profile-card__eyebrow">Workspace appearance</p>
              <h2>Visual preset</h2>
            </div>
            <AppearanceIcon preset={preset} />
          </div>
          <p className="profile-card__copy">
            Choose the light or dark workspace appearance.
          </p>
          <div aria-label="Visual preset" className="profile-preset-grid" role="group">
            {themePresets.map((themePreset) => (
              <PresetOption
                key={themePreset.name}
                isSelected={themePreset.name === preset.name}
                onSelect={() => setPresetName(themePreset.name)}
                preset={themePreset}
              />
            ))}
          </div>
          <ThemeColourControls
            darkThemeColour={darkThemeColour}
            lightThemeColour={lightThemeColour}
            onSelect={setThemeColour}
          />
          <p aria-live="polite" className="profile-save-status" role="status">
            {saveStatus === 'saving' ? 'Saving your appearance preference…' : null}
            {saveStatus === 'saved' ? 'Appearance preference saved.' : null}
            {saveStatus === 'error' ? 'The server could not save this preference; local fallback is active.' : null}
          </p>
        </Card>
      </div>

      <Card className="profile-card profile-fdr-card">
        <div className="profile-card__header">
          <div>
            <p className="profile-card__eyebrow">Fixture difficulty</p>
            <h2>FDR colour scale</h2>
          </div>
          <span className="profile-fdr-count">{fdrColourScales.length} options</span>
        </div>
        <p className="profile-card__copy">
          Show extremely easy fixtures as 1 and extremely difficult fixtures as 5. The selected
          scale is used for opponent labels, FDR tables, and fixture cues.
        </p>
        <Button
          aria-controls="fdr-scale-sheet"
          aria-expanded={isFdrScaleSheetOpen}
          className="profile-fdr-scale-trigger"
          onClick={() => setIsFdrScaleSheetOpen(true)}
          type="button"
          variant="secondary"
        >
          <span>
            <strong>Option {selectedFdrScaleNumber}</strong>
            <small>Five FDR colour steps</small>
          </span>
          <ChevronRight aria-hidden="true" size={18} />
        </Button>
        <div aria-label="Selected FDR colour scale preview" className="profile-fdr-preview-container">
          <FdrPalettePreview
            displayMode={fdrDisplayMode}
            mode={themeMode}
            reversed={fdrScaleReversed}
            scale={selectedFdrScale}
          />
        </div>
        <div aria-label="FDR display style" className="profile-fdr-display-mode" role="group">
          <DisplayModeOption
            displayMode="font"
            isSelected={fdrDisplayMode === 'font'}
            onSelect={() => setFdrDisplayMode('font')}
          />
          <DisplayModeOption
            displayMode="fill"
            isSelected={fdrDisplayMode === 'fill'}
            onSelect={() => setFdrDisplayMode('fill')}
          />
        </div>
        <label className="profile-fdr-reverse-toggle">
          <input
            checked={fdrScaleReversed}
            onChange={(event) => setFdrScaleReversed(event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Reverse order</strong>
            <small>Swap which end of the chosen scale represents 1 and 5.</small>
          </span>
        </label>
      </Card>

      {isFdrScaleSheetOpen ? (
        <button
          aria-label="Close FDR colour scale chooser"
          className="profile-fdr-sheet-backdrop"
          onClick={() => setIsFdrScaleSheetOpen(false)}
          type="button"
        />
      ) : null}
      <Sheet id="fdr-scale-sheet" isOpen={isFdrScaleSheetOpen} labelledBy="fdr-scale-sheet-title">
        <div className="profile-fdr-sheet">
          <header className="profile-fdr-sheet__header">
            <div>
              <p className="profile-card__eyebrow">FDR colour scale</p>
              <h2 id="fdr-scale-sheet-title">Choose a scale</h2>
            </div>
            <Button
              aria-label="Close FDR colour scale chooser"
              className="profile-fdr-sheet__close"
              onClick={() => setIsFdrScaleSheetOpen(false)}
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" size={18} />
            </Button>
          </header>
          <div className="profile-fdr-scale-list">
            {fdrColourScales.map((scale, index) => (
              <div key={scale.name}>
                {scale.group === 'Custom' && fdrColourScales[index - 1]?.group !== 'Custom' ? (
                  <h3 className="profile-fdr-custom-heading">Three-colour options</h3>
                ) : null}
                <button
                  aria-label={`FDR colour scale option ${index + 1}`}
                  aria-pressed={scale.name === fdrScale}
                  className={`profile-fdr-scale-option${scale.name === fdrScale ? ' is-selected' : ''}`}
                  data-scale-name={scale.name}
                  onClick={() => {
                    setFdrScale(scale.name);
                    setIsFdrScaleSheetOpen(false);
                  }}
                  type="button"
                >
                  <span aria-hidden="true" className="profile-fdr-scale-option__number">{index + 1}</span>
                  <span className="profile-fdr-scale-option__previews">
                    <FdrPaletteBar
                      displayMode={fdrDisplayMode}
                      mode={themeMode}
                      reversed={fdrScaleReversed}
                      scale={scale}
                    />
                  </span>
                  <span aria-hidden="true" className="profile-preset-check">
                    {scale.name === fdrScale ? <Check size={15} /> : <Circle size={15} />}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </Sheet>

      <Card className="profile-card profile-pitch-card">
        <div className="profile-card__header">
          <div>
            <p className="profile-card__eyebrow">Pitch orientation</p>
            <h2>Your attacking direction</h2>
          </div>
          {attackDirection === 'up' ? <ArrowUp aria-hidden="true" className="profile-appearance-icon" size={21} /> : <ArrowDown aria-hidden="true" className="profile-appearance-icon" size={21} />}
        </div>
        <p className="profile-card__copy">
          Choose the direction your team attacks. Pitch views show the attacking end in the same
          direction every time, with the opposition facing the other way.
        </p>
        <div aria-label="Attacking direction" className="profile-direction-grid" role="group">
          <DirectionOption
            direction="up"
            isSelected={attackDirection === 'up'}
            onSelect={() => setAttackDirection('up')}
          />
          <DirectionOption
            direction="down"
            isSelected={attackDirection === 'down'}
            onSelect={() => setAttackDirection('down')}
          />
        </div>
      </Card>

      <Card className="profile-card profile-session-card">
        <div>
          <p className="profile-card__eyebrow">Data &amp; session</p>
          <h2>Account actions</h2>
          <p>Refresh your account data or end your current manager session.</p>
        </div>
        <div className="profile-session-card__actions">
          <Button onClick={onRefresh} type="button" variant="secondary">
            <RefreshCw aria-hidden="true" size={17} />
            Refresh data
          </Button>
          <Button onClick={onSignOut} type="button" variant="ghost">
            <LogOut aria-hidden="true" size={17} />
            Sign out
          </Button>
        </div>
      </Card>
    </main>
  );
}

function DirectionOption({
  direction,
  isSelected,
  onSelect,
}: {
  direction: AttackDirection;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isUp = direction === 'up';
  const Icon = isUp ? ArrowUp : ArrowDown;
  return (
    <button
      aria-pressed={isSelected}
      className={`profile-direction-option${isSelected ? ' is-selected' : ''}`}
      onClick={onSelect}
      type="button"
    >
      <span aria-hidden="true" className="profile-direction-icon"><Icon size={22} /></span>
      <span className="profile-direction-copy">
        <strong>{isUp ? 'Attack upwards' : 'Attack downwards'}</strong>
        <small>{isUp ? 'Forwards at the top of the pitch view' : 'Forwards at the bottom of the pitch view'}</small>
      </span>
      <span aria-hidden="true" className="profile-preset-check">
        {isSelected ? <Check size={15} /> : <Circle size={15} />}
      </span>
    </button>
  );
}

function AppearanceIcon({ preset }: { preset: ThemePreset }) {
  const Icon = getThemeMode(preset) === 'dark' ? Moon : Sun;
  return <Icon aria-hidden="true" className="profile-appearance-icon" size={20} />;
}

function getFdrScaleOptionNumber(scaleName: FdrColourScale['name']): number {
  return Math.max(0, fdrColourScales.findIndex((scale) => scale.name === scaleName)) + 1;
}

function FdrPalettePreview({
  displayMode,
  mode,
  reversed,
  scale,
}: {
  displayMode: FdrDisplayMode;
  mode: 'light' | 'dark';
  reversed: boolean;
  scale: FdrColourScale;
}) {
  const palette = getFdrPalette(scale.name, mode, reversed);
  return (
    <div className="profile-fdr-preview" data-mode={mode}>
      <div className="profile-fdr-preview__header">
        <strong>{mode === 'light' ? 'Light theme' : 'Dark theme'}</strong>
        <small>{displayMode === 'font' ? 'Coloured font' : 'Coloured fill'}</small>
      </div>
      <FdrPaletteBar displayMode={displayMode} mode={mode} reversed={reversed} scale={scale} />
      <div className="profile-fdr-preview__labels">
        {palette.map((colour, index) => (
          <span key={`${scale.name}-${mode}-${index}`} style={{ color: colour }}>
            <strong>{index + 1}</strong>
            <small>{fdrDifficultyLabels[index]}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function FdrPaletteBar({
  displayMode,
  mode,
  reversed,
  scale,
}: {
  displayMode: FdrDisplayMode;
  mode: 'light' | 'dark';
  reversed: boolean;
  scale: FdrColourScale;
}) {
  const palette = getFdrDisplayPalette(scale.name, mode, reversed, displayMode);
  return (
    <span aria-label={`FDR colour scale option ${getFdrScaleOptionNumber(scale.name)}`} className="profile-fdr-palette-bar" data-display-mode={displayMode}>
      {palette.map((colour, index) => (
        <span
          aria-label={`FDR ${index + 1}: ${colour}`}
          key={`${scale.name}-${mode}-${index}`}
          style={{
            backgroundColor: getFdrDisplayBackground(colour, displayMode),
            color: getFdrDisplayForeground(colour, displayMode),
          }}
          title={`FDR ${index + 1} · ${fdrDifficultyLabels[index]} · ${colour}`}
        >
          {index + 1}
        </span>
      ))}
    </span>
  );
}

const fdrDifficultyLabels = ['Very easy', 'Easy', 'Balanced', 'Hard', 'Very hard'] as const;

function getFdrDisplayPalette(
  name: FdrColourScale['name'],
  mode: 'light' | 'dark',
  reversed: boolean,
  displayMode: FdrDisplayMode,
) {
  return displayMode === 'fill'
    ? getFdrFillPalette(name, mode, reversed)
    : getFdrPalette(name, mode, reversed);
}

function getFdrDisplayBackground(colour: string, displayMode: FdrDisplayMode): string {
  return displayMode === 'fill' ? colour : `color-mix(in srgb, ${colour} 16%, var(--surface))`;
}

function getFdrDisplayForeground(colour: string, displayMode: FdrDisplayMode): string {
  return displayMode === 'fill' ? getFdrFillForeground(colour) : colour;
}

function DisplayModeOption({
  displayMode,
  isSelected,
  onSelect,
}: {
  displayMode: FdrDisplayMode;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isFill = displayMode === 'fill';
  const Icon = isFill ? PaintBucket : Type;
  return (
    <button
      aria-pressed={isSelected}
      className={`profile-fdr-display-option${isSelected ? ' is-selected' : ''}`}
      onClick={onSelect}
      type="button"
    >
      <span aria-hidden="true" className="profile-direction-icon"><Icon size={18} /></span>
      <span className="profile-direction-copy">
        <strong>{isFill ? 'Coloured fill' : 'Coloured font'}</strong>
        <small>{isFill ? 'Black or white text chosen for contrast' : 'Use the scale on the opponent text'}</small>
      </span>
      <span aria-hidden="true" className="profile-preset-check">
        {isSelected ? <Check size={15} /> : <Circle size={15} />}
      </span>
    </button>
  );
}

function ThemeColourControls({
  darkThemeColour,
  lightThemeColour,
  onSelect,
}: {
  darkThemeColour: string;
  lightThemeColour: string;
  onSelect: (mode: ThemeColourMode, colour: string) => void;
}) {
  const colours: Record<ThemeColourMode, string> = {
    light: lightThemeColour,
    dark: darkThemeColour,
  };

  return (
    <section aria-labelledby="main-theme-colour-title" className="profile-theme-colours">
      <div className="profile-theme-colours__header">
        <div>
          <strong id="main-theme-colour-title">Main theme colour</strong>
          <small>Choose a separate accent for light and dark mode.</small>
        </div>
      </div>
      {(['light', 'dark'] as const).map((mode) => (
        <div className="profile-theme-colour-row" data-theme-colour-mode={mode} key={mode}>
          <div className="profile-theme-colour-row__copy">
            <strong>{mode === 'light' ? 'Light mode' : 'Dark mode'}</strong>
            <small>{colours[mode]}</small>
          </div>
          <div aria-label={`${mode === 'light' ? 'Light' : 'Dark'} mode theme colours`} className="profile-theme-colour-options" role="group">
            {themeColourOptions.map((option) => (
              <button
                aria-label={`${option.label} ${mode} theme colour`}
                aria-pressed={colours[mode] === option[mode]}
                className={`profile-theme-colour-swatch${colours[mode] === option[mode] ? ' is-selected' : ''}`}
                key={`${mode}-${option.label}`}
                onClick={() => onSelect(mode, option[mode])}
                style={{ '--swatch-colour': option[mode] } as CSSProperties}
                title={option.label}
                type="button"
              />
            ))}
            <label className="profile-theme-colour-picker">
              <span className="sr-only">Choose a custom {mode} mode theme colour</span>
              <input
                aria-label={`Custom ${mode} mode theme colour`}
                onChange={(event) => onSelect(mode, event.target.value)}
                type="color"
                value={colours[mode]}
              />
            </label>
          </div>
        </div>
      ))}
    </section>
  );
}

function PresetOption({
  isSelected,
  onSelect,
  preset,
}: {
  isSelected: boolean;
  onSelect: () => void;
  preset: ThemePreset;
}) {
  const previewStyle = {
    '--preview-background': preset.tokens.colors.background,
    '--preview-card': preset.tokens.colors.card,
    '--preview-primary': preset.tokens.colors.primary,
    '--preview-border': preset.tokens.colors.border,
  } as CSSProperties;

  return (
    <button
      aria-pressed={isSelected}
      className={`profile-preset-option${isSelected ? ' is-selected' : ''}`}
      onClick={onSelect}
      type="button"
    >
      <span aria-hidden="true" className="profile-preset-preview" style={previewStyle}>
        <span />
        <span />
        <span />
      </span>
      <span className="profile-preset-copy">
        <strong>{preset.label}</strong>
        <small>{preset.description}</small>
      </span>
      <span aria-hidden="true" className="profile-preset-check">
        {isSelected ? <Check size={15} /> : <Circle size={15} />}
      </span>
    </button>
  );
}

export default ProfilePage;
