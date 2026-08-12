import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Circle,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  Sun,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Sheet } from './components/ui/sheet';
import type { AttackDirection, SessionState, ThemePreset } from './contracts';
import {
  fdrColourScales,
  getFdrPalette,
  getFdrColourScale,
  type FdrColourScale,
  type FdrScaleGroup,
} from './fdr-colour-scales';
import { getThemeMode, themePresets } from './theme-presets';
import { useThemePreset } from './theme-preset-provider';
import './profile-page.css';

interface ProfilePageProps {
  onRefresh: () => void;
  onSignOut: () => void;
  session: SessionState;
}

export function ProfilePage({ onRefresh, onSignOut, session }: ProfilePageProps) {
  const {
    attackDirection,
    fdrScale,
    fdrScaleReversed,
    preset,
    saveStatus,
    setAttackDirection,
    setFdrScale,
    setFdrScaleReversed,
    setPresetName,
  } = useThemePreset();
  const [isFdrScaleSheetOpen, setIsFdrScaleSheetOpen] = useState(false);
  const [fdrScaleSearch, setFdrScaleSearch] = useState('');
  const user = session.user;
  const selectedFdrScale = getFdrColourScale(fdrScale);
  const filteredFdrScales = useMemo(() => {
    const query = fdrScaleSearch.trim().toLowerCase();
    if (!query) return fdrColourScales;
    return fdrColourScales.filter((scale) => `${scale.name} ${scale.label} ${scale.group}`.toLowerCase().includes(query));
  }, [fdrScaleSearch]);
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
            All options use the shared Teal token set. Pick light or dark, then choose the compact
            density when you want more information on screen.
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
            <strong>{selectedFdrScale.label}</strong>
            <small>{selectedFdrScale.name} · {selectedFdrScale.group}</small>
          </span>
          <ChevronRight aria-hidden="true" size={18} />
        </Button>
        <div aria-label="Selected FDR colour scale preview" className="profile-fdr-preview-pair">
          <FdrPalettePreview mode="light" reversed={fdrScaleReversed} scale={selectedFdrScale} />
          <FdrPalettePreview mode="dark" reversed={fdrScaleReversed} scale={selectedFdrScale} />
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
          <p className="profile-card__copy">
            Each option is shown for both themes. Cyclical scales stop at 70% of their colour cycle
            so level 5 does not wrap back towards level 1.
          </p>
          <label className="profile-fdr-search">
            <Search aria-hidden="true" size={16} />
            <span className="sr-only">Search FDR colour scales</span>
            <input
              onChange={(event) => setFdrScaleSearch(event.target.value)}
              placeholder="Search scales"
              type="search"
              value={fdrScaleSearch}
            />
          </label>
          <div className="profile-fdr-scale-list">
            {(['Diverging', 'Sequential', 'Cyclical'] as FdrScaleGroup[]).map((group) => {
              const groupScales = filteredFdrScales.filter((scale) => scale.group === group);
              if (groupScales.length === 0) return null;
              return (
                <section aria-labelledby={`fdr-scale-group-${group.toLowerCase()}`} key={group}>
                  <h3 id={`fdr-scale-group-${group.toLowerCase()}`}>{group}</h3>
                  <div className="profile-fdr-scale-options">
                    {groupScales.map((scale) => (
                      <button
                        aria-pressed={scale.name === fdrScale}
                        className={`profile-fdr-scale-option${scale.name === fdrScale ? ' is-selected' : ''}`}
                        key={scale.name}
                        onClick={() => {
                          setFdrScale(scale.name);
                          setIsFdrScaleSheetOpen(false);
                        }}
                        type="button"
                      >
                        <span className="profile-fdr-scale-option__copy">
                          <strong>{scale.label}</strong>
                          <small>{scale.name}</small>
                        </span>
                        <span className="profile-fdr-scale-option__previews">
                          <FdrPaletteBar mode="light" reversed={fdrScaleReversed} scale={scale} />
                          <FdrPaletteBar mode="dark" reversed={fdrScaleReversed} scale={scale} />
                        </span>
                        <span aria-hidden="true" className="profile-preset-check">
                          {scale.name === fdrScale ? <Check size={15} /> : <Circle size={15} />}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            {filteredFdrScales.length === 0 ? <p className="profile-fdr-empty">No scales match that search.</p> : null}
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

function FdrPalettePreview({
  mode,
  reversed,
  scale,
}: {
  mode: 'light' | 'dark';
  reversed: boolean;
  scale: FdrColourScale;
}) {
  return (
    <div className="profile-fdr-preview" data-mode={mode}>
      <div className="profile-fdr-preview__header">
        <strong>{mode === 'light' ? 'Light theme' : 'Dark theme'}</strong>
        <small>1 easy · 5 difficult</small>
      </div>
      <FdrPaletteBar mode={mode} reversed={reversed} scale={scale} />
      <div aria-hidden="true" className="profile-fdr-preview__levels">
        {[1, 2, 3, 4, 5].map((level) => <span key={level}>{level}</span>)}
      </div>
    </div>
  );
}

function FdrPaletteBar({
  mode,
  reversed,
  scale,
}: {
  mode: 'light' | 'dark';
  reversed: boolean;
  scale: FdrColourScale;
}) {
  return (
    <span aria-label={`${scale.label} ${mode} theme colour steps`} className="profile-fdr-palette-bar">
      {getFdrPalette(scale.name, mode, reversed).map((colour, index) => (
        <span
          aria-label={`FDR ${index + 1}: ${colour}`}
          key={`${scale.name}-${mode}-${index}`}
          style={{ backgroundColor: colour }}
          title={`FDR ${index + 1} · ${colour}`}
        />
      ))}
    </span>
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
