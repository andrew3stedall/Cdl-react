import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Circle,
  Fingerprint,
  Moon,
  Sun,
  Type,
  PaintBucket,
  Trash2,
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
  type FdrCustomAnchors,
  type FdrCustomPalette,
  type FdrColourScale,
  type FdrDisplayMode,
} from './fdr-colour-scales';
import { getThemeMode, themePresets } from './theme-presets';
import { useThemePreset } from './theme-preset-provider';
import { getThemeColourForMode, themeColourOptions } from './theme-colours';
import { getPasskeyStatus, registerPasskey, type PasskeyStatus } from './passkeys';
import './profile-page.css';

interface ProfilePageProps {
  currentPath: string;
  onNavigate: (href: string) => void;
  session: SessionState;
}

export function ProfilePage({ currentPath, onNavigate, session }: ProfilePageProps) {
  const {
    attackDirection,
    fdrDisplayMode,
    fdrScale,
    fdrScaleReversed,
    customFdrAnchors,
    customFdrPalettes,
    themeColour,
    preset,
    saveStatus,
    setAttackDirection,
    setFdrDisplayMode,
    setFdrScale,
    setFdrScaleReversed,
    setCustomFdrAnchors,
    saveCustomFdrPalette,
    deleteCustomFdrPalette,
    useCustomFdrPalette,
    setThemeColour,
    setPresetName,
  } = useThemePreset();
  const [isFdrScaleSheetOpen, setIsFdrScaleSheetOpen] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState<PasskeyStatus | null>(null);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);
  const isAccountSummary = currentPath === '/account' || currentPath === '/profile';
  const isAppearancePage = currentPath === '/account/appearance' || currentPath === '/profile/appearance';
  const isFdrPage = currentPath === '/account/fdr' || currentPath === '/profile/fdr';
  const isOrientationPage = currentPath === '/account/orientation' || currentPath === '/profile/orientation';

  useEffect(() => {
    if (!isAccountSummary) return undefined;

    let active = true;
    void getPasskeyStatus()
      .then((status) => {
        if (active) setPasskeyStatus(status);
      })
      .catch(() => {
        if (active) setPasskeyStatus({ enabled: false, registeredCount: 0 });
      });

    return () => {
      active = false;
    };
  }, [isAccountSummary]);

  useEffect(() => {
    if (!isFdrScaleSheetOpen) return undefined;

    const documentElement = document.documentElement;
    const body = document.body;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const previousDocumentOverflow = documentElement.style.overflow;
    const previousDocumentOverscrollBehavior = documentElement.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyLeft = body.style.left;
    const previousBodyRight = body.style.right;
    const previousBodyWidth = body.style.width;

    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = `-${scrollX}px`;
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      documentElement.style.overflow = previousDocumentOverflow;
      documentElement.style.overscrollBehavior = previousDocumentOverscrollBehavior;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.left = previousBodyLeft;
      body.style.right = previousBodyRight;
      body.style.width = previousBodyWidth;
      window.scrollTo(scrollX, scrollY);
    };
  }, [isFdrScaleSheetOpen]);

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

  if (isAppearancePage) {
    return (
      <main aria-labelledby="account-settings-title" className="feature-screen profile-page profile-page--subpage">
        <SettingsPageHeader onBack={() => onNavigate('/account')} title="Visual preset" />
        <AppearanceSettingsCard
          preset={preset}
          saveStatus={saveStatus}
          setPresetName={setPresetName}
          setThemeColour={setThemeColour}
          themeColour={themeColour}
        />
      </main>
    );
  }

  if (isFdrPage) {
    return (
      <main aria-labelledby="account-settings-title" className="feature-screen profile-page profile-page--subpage">
        <SettingsPageHeader onBack={() => onNavigate('/account')} title="FDR colour scale" />
        <FdrSettingsCard
          customFdrAnchors={customFdrAnchors}
          fdrDisplayMode={fdrDisplayMode}
          fdrScale={fdrScale}
          fdrScaleReversed={fdrScaleReversed}
          isFdrScaleSheetOpen={isFdrScaleSheetOpen}
          onOpenSheet={() => setIsFdrScaleSheetOpen(true)}
          onSetFdrDisplayMode={setFdrDisplayMode}
          onSetFdrScaleReversed={setFdrScaleReversed}
          selectedFdrScale={selectedFdrScale}
          selectedFdrScaleNumber={selectedFdrScaleNumber}
          themeMode={themeMode}
        />
        <FdrScaleChooser
          customFdrAnchors={customFdrAnchors}
          customFdrPalettes={customFdrPalettes}
          deleteCustomFdrPalette={deleteCustomFdrPalette}
          fdrDisplayMode={fdrDisplayMode}
          fdrScale={fdrScale}
          fdrScaleReversed={fdrScaleReversed}
          isOpen={isFdrScaleSheetOpen}
          onClose={() => setIsFdrScaleSheetOpen(false)}
          onSave={saveCustomFdrPalette}
          onSetCustomFdrAnchors={setCustomFdrAnchors}
          onSetFdrScale={setFdrScale}
          onUseCustomFdrPalette={useCustomFdrPalette}
          themeMode={themeMode}
        />
      </main>
    );
  }

  if (isOrientationPage) {
    return (
      <main aria-labelledby="account-settings-title" className="feature-screen profile-page profile-page--subpage">
        <SettingsPageHeader onBack={() => onNavigate('/account')} title="Attacking orientation" />
        <PitchSettingsCard attackDirection={attackDirection} onSetAttackDirection={setAttackDirection} />
      </main>
    );
  }

  return (
    <main aria-labelledby="account-title" className="feature-screen profile-page profile-page--summary">
      <header className="profile-page__header">
        <p className="eyebrow">Account</p>
        <h1 id="account-title">Account</h1>
        <p>Manage your identity, workspace appearance, pitch orientation, and FDR colours.</p>
      </header>

      {isAccountSummary && passkeyStatus?.enabled && passkeyStatus.registeredCount === 0 ? (
        <Card className="profile-card profile-security-card">
          <div className="profile-card__header">
            <div>
              <p className="profile-card__eyebrow">Fast sign-in</p>
              <h2>Use Face ID or fingerprint</h2>
            </div>
            <Fingerprint aria-hidden="true" className="profile-appearance-icon" size={22} />
          </div>
          <Button
            disabled={passkeyPending}
            onClick={() => {
              setPasskeyMessage(null);
              setPasskeyPending(true);
              void registerPasskey()
                .then((result) => {
                  if (result.ok) {
                    setPasskeyStatus({ enabled: true, registeredCount: 1 });
                    setPasskeyMessage('Passkey added on this device.');
                  } else {
                    setPasskeyMessage(result.error.message);
                  }
                })
                .finally(() => setPasskeyPending(false));
            }}
            type="button"
            variant="secondary"
          >
            <Fingerprint aria-hidden="true" size={17} />
            {passkeyPending ? 'Waiting for device verification…' : 'Enable device sign-in'}
          </Button>
          {passkeyMessage ? <p aria-live="polite" className="profile-save-status" role="status">{passkeyMessage}</p> : null}
        </Card>
      ) : null}

      <div className="profile-page__summary-grid">
        <Card className="profile-card profile-identity-card">
          <div className="profile-identity">
            <span aria-hidden="true" className="profile-avatar">{initials}</span>
            <div>
              <p className="profile-card__eyebrow">Manager account</p>
              <h2>{displayName}</h2>
              <p>{user?.email ?? 'No email address available'}</p>
            </div>
          </div>
        </Card>

        <ProfileSummaryCard
          ariaLabel="Open workspace appearance settings"
          onSelect={() => onNavigate('/account/appearance')}
        >
          <div className="profile-card__header">
            <div>
              <p className="profile-card__eyebrow">Workspace appearance</p>
              <h2>Visual preset</h2>
            </div>
            <AppearanceIcon preset={preset} />
          </div>
          <span className="profile-summary-value">{preset.label} · {themeColour}</span>
          <AppearanceSummaryPreview preset={preset} themeColour={themeColour} />
          <ChevronRight aria-hidden="true" className="profile-summary-card__arrow" size={18} />
        </ProfileSummaryCard>

        <ProfileSummaryCard
          ariaLabel="Open FDR colour scale settings"
          onSelect={() => onNavigate('/account/fdr')}
        >
          <div className="profile-card__header">
            <div>
              <p className="profile-card__eyebrow">Fixture difficulty</p>
              <h2>FDR colour scale</h2>
            </div>
            <ChevronRight aria-hidden="true" className="profile-summary-card__arrow" size={18} />
          </div>
          <span className="profile-summary-value">
            {selectedFdrScaleNumber ? `Option ${selectedFdrScaleNumber}` : selectedFdrScale.label} · {fdrDisplayMode === 'fill' ? 'Coloured fill' : 'Coloured font'}
          </span>
          <div aria-label="Current FDR colour scale" className="profile-fdr-summary-preview">
            <FdrPaletteBar
              customAnchors={customFdrAnchors}
              displayMode={fdrDisplayMode}
              mode={themeMode}
              reversed={fdrScaleReversed}
              scale={selectedFdrScale}
            />
          </div>
        </ProfileSummaryCard>

        <ProfileSummaryCard
          ariaLabel={`Current attacking orientation: attack ${attackDirection === 'up' ? 'upwards' : 'downwards'}. Open settings.`}
          onSelect={() => onNavigate('/account/orientation')}
        >
          <div className="profile-card__header">
            <div>
              <p className="profile-card__eyebrow">Pitch orientation</p>
              <h2>Attacking direction</h2>
            </div>
            <ChevronRight aria-hidden="true" className="profile-summary-card__arrow" size={18} />
          </div>
          <span aria-hidden="true" className="profile-pitch-summary-demo">
            {attackDirection === 'up' ? <ArrowUp size={42} /> : <ArrowDown size={42} />}
          </span>
        </ProfileSummaryCard>
      </div>
    </main>
  );
}

function SettingsPageHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <header className="profile-page__header profile-page__header--subpage">
      <button className="profile-subpage-back" onClick={onBack} type="button">
        <ArrowLeft aria-hidden="true" size={17} />
        Account
      </button>
      <p className="eyebrow">Account</p>
      <h1 id="account-settings-title">{title}</h1>
    </header>
  );
}

function ProfileSummaryCard({ ariaLabel, children, onSelect }: { ariaLabel: string; children: ReactNode; onSelect: () => void }) {
  return (
    <button aria-label={ariaLabel} className="ui-card profile-card profile-summary-card" onClick={onSelect} type="button">
      {children}
    </button>
  );
}

function AppearanceSummaryPreview({ preset, themeColour }: { preset: ThemePreset; themeColour: string }) {
  const mode = getThemeMode(preset);
  const previewStyle = {
    '--summary-preview-background': preset.tokens.colors.background,
    '--summary-preview-card': preset.tokens.colors.card,
    '--summary-preview-border': preset.tokens.colors.border,
    '--summary-preview-foreground': preset.tokens.colors.foreground,
    '--summary-preview-primary': getThemeColourForMode(themeColour, mode),
  } as CSSProperties;

  return (
    <span aria-label={`${preset.label} with accent ${themeColour}`} className="profile-appearance-summary-preview" style={previewStyle}>
      <span className="profile-appearance-summary-preview__sidebar" />
      <span className="profile-appearance-summary-preview__content">
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}

function AppearanceSettingsCard({
  preset,
  saveStatus,
  setPresetName,
  setThemeColour,
  themeColour,
}: {
  preset: ThemePreset;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  setPresetName: (presetName: ThemePreset['name']) => void;
  setThemeColour: (colour: string) => void;
  themeColour: string;
}) {
  return (
    <Card className="profile-card profile-appearance-card profile-settings-card">
      <div className="profile-card__header">
        <div>
          <p className="profile-card__eyebrow">Workspace appearance</p>
          <h2>Visual preset</h2>
        </div>
        <AppearanceIcon preset={preset} />
      </div>
      <p className="profile-card__copy">Choose the light, dark, or adaptive workspace appearance.</p>
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
      <ThemeColourControls themeColour={themeColour} onSelect={setThemeColour} />
      <p aria-live="polite" className="profile-save-status" role="status">
        {saveStatus === 'saving' ? 'Saving your appearance preference…' : null}
        {saveStatus === 'saved' ? 'Appearance preference saved.' : null}
        {saveStatus === 'error' ? 'The server could not save this preference; local fallback is active.' : null}
      </p>
    </Card>
  );
}

function FdrSettingsCard({
  customFdrAnchors,
  fdrDisplayMode,
  fdrScale,
  fdrScaleReversed,
  isFdrScaleSheetOpen,
  onOpenSheet,
  onSetFdrDisplayMode,
  onSetFdrScaleReversed,
  selectedFdrScale,
  selectedFdrScaleNumber,
  themeMode,
}: {
  customFdrAnchors: FdrCustomAnchors;
  fdrDisplayMode: FdrDisplayMode;
  fdrScale: FdrColourScale['name'];
  fdrScaleReversed: boolean;
  isFdrScaleSheetOpen: boolean;
  onOpenSheet: () => void;
  onSetFdrDisplayMode: (mode: FdrDisplayMode) => void;
  onSetFdrScaleReversed: (reversed: boolean) => void;
  selectedFdrScale: FdrColourScale;
  selectedFdrScaleNumber: number | null;
  themeMode: 'light' | 'dark';
}) {
  return (
    <Card className="profile-card profile-fdr-card profile-settings-card">
      <div className="profile-card__header">
        <div>
          <p className="profile-card__eyebrow">Fixture difficulty</p>
          <h2>FDR colour scale</h2>
        </div>
        <span className="profile-fdr-count">{fdrColourScales.length} presets + custom</span>
      </div>
      <p className="profile-card__copy">Choose how fixture difficulty is coloured across the workspace.</p>
      <Button
        aria-controls="fdr-scale-sheet"
        aria-expanded={isFdrScaleSheetOpen}
        className="profile-fdr-scale-trigger"
        onClick={onOpenSheet}
        type="button"
        variant="secondary"
      >
        <span>
          <strong>{selectedFdrScaleNumber ? `Option ${selectedFdrScaleNumber}` : selectedFdrScale.label}</strong>
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
          customAnchors={customFdrAnchors}
        />
      </div>
      <div aria-label="FDR display style" className="profile-fdr-display-mode" role="group">
        <DisplayModeOption displayMode="font" isSelected={fdrDisplayMode === 'font'} onSelect={() => onSetFdrDisplayMode('font')} />
        <DisplayModeOption displayMode="fill" isSelected={fdrDisplayMode === 'fill'} onSelect={() => onSetFdrDisplayMode('fill')} />
      </div>
      <label className="profile-fdr-reverse-toggle">
        <input checked={fdrScaleReversed} onChange={(event) => onSetFdrScaleReversed(event.target.checked)} type="checkbox" />
        <span>
          <strong>Reverse order</strong>
          <small>Swap which end of the chosen scale represents 1 and 5.</small>
        </span>
      </label>
      <span className="sr-only">Current FDR scale: {fdrScale}</span>
    </Card>
  );
}

function PitchSettingsCard({ attackDirection, onSetAttackDirection }: { attackDirection: AttackDirection; onSetAttackDirection: (direction: AttackDirection) => void }) {
  return (
    <Card className="profile-card profile-pitch-card profile-settings-card">
      <div className="profile-card__header">
        <div>
          <p className="profile-card__eyebrow">Pitch orientation</p>
          <h2>Your attacking direction</h2>
        </div>
        {attackDirection === 'up' ? <ArrowUp aria-hidden="true" className="profile-appearance-icon" size={21} /> : <ArrowDown aria-hidden="true" className="profile-appearance-icon" size={21} />}
      </div>
      <p className="profile-card__copy">Choose the direction your team attacks in pitch views.</p>
      <div aria-label="Attacking direction" className="profile-direction-grid" role="group">
        <DirectionOption direction="up" isSelected={attackDirection === 'up'} onSelect={() => onSetAttackDirection('up')} />
        <DirectionOption direction="down" isSelected={attackDirection === 'down'} onSelect={() => onSetAttackDirection('down')} />
      </div>
    </Card>
  );
}

function FdrScaleChooser({
  customFdrAnchors,
  customFdrPalettes,
  deleteCustomFdrPalette,
  fdrDisplayMode,
  fdrScale,
  fdrScaleReversed,
  isOpen,
  onClose,
  onSave,
  onSetCustomFdrAnchors,
  onSetFdrScale,
  onUseCustomFdrPalette,
  themeMode,
}: {
  customFdrAnchors: FdrCustomAnchors;
  customFdrPalettes: FdrCustomPalette[];
  deleteCustomFdrPalette: (paletteId: string) => Promise<void>;
  fdrDisplayMode: FdrDisplayMode;
  fdrScale: FdrColourScale['name'];
  fdrScaleReversed: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSave: (palette: { name: string; mode: 'anchors' | 'all'; anchors: FdrCustomAnchors }) => Promise<FdrCustomPalette>;
  onSetCustomFdrAnchors: (anchors: FdrCustomAnchors) => void;
  onSetFdrScale: (scale: 'CustomHex' | 'CustomAll' | FdrColourScale['name']) => void;
  onUseCustomFdrPalette: (palette: FdrCustomPalette) => void;
  themeMode: 'light' | 'dark';
}) {
  return (
    <>
      {isOpen ? <button aria-label="Close FDR colour scale chooser" className="profile-fdr-sheet-backdrop" onClick={onClose} type="button" /> : null}
      <Sheet id="fdr-scale-sheet" isOpen={isOpen} labelledBy="fdr-scale-sheet-title">
        <div className="profile-fdr-sheet">
          <header className="profile-fdr-sheet__header">
            <div>
              <p className="profile-card__eyebrow">FDR colour scale</p>
              <h2 id="fdr-scale-sheet-title">Choose a scale</h2>
            </div>
            <Button aria-label="Close FDR colour scale chooser" className="profile-fdr-sheet__close" onClick={onClose} type="button" variant="ghost">
              <X aria-hidden="true" size={18} />
            </Button>
          </header>
          <div className="profile-fdr-scale-list">
            <section aria-labelledby="profile-fdr-custom-heading">
              <h3 className="profile-fdr-custom-heading" id="profile-fdr-custom-heading">Custom scales</h3>
              <CustomFdrScaleEditor
                anchors={customFdrAnchors}
                onChange={onSetCustomFdrAnchors}
                onSave={onSave}
                onUse={(scaleName) => {
                  onSetFdrScale(scaleName);
                  onClose();
                }}
                selectedScaleName={fdrScale}
              />
              <div aria-label="Saved custom FDR palettes" className="profile-fdr-saved-palettes">
                <div className="profile-fdr-saved-palettes__header">
                  <h4>Saved palettes</h4>
                  <small>Only palettes you save here can be deleted.</small>
                </div>
                {customFdrPalettes.length ? customFdrPalettes.map((palette) => (
                  <SavedFdrPaletteOption
                    key={palette.id}
                    onDelete={() => deleteCustomFdrPalette(palette.id)}
                    onUse={() => {
                      onUseCustomFdrPalette(palette);
                      onClose();
                    }}
                    palette={palette}
                  />
                )) : (
                  <p className="profile-fdr-saved-palettes__empty">Save a custom palette to keep it here for later.</p>
                )}
              </div>
            </section>
            <section aria-labelledby="profile-fdr-presets-heading">
              <h3 className="profile-fdr-custom-heading" id="profile-fdr-presets-heading">Numbered presets</h3>
              {fdrColourScales.map((scale) => (
                <button
                  aria-label={`FDR colour scale option ${scale.optionNumber}`}
                  aria-pressed={scale.name === fdrScale}
                  className={`profile-fdr-scale-option${scale.name === fdrScale ? ' is-selected' : ''}`}
                  data-scale-name={scale.name}
                  key={scale.name}
                  onClick={() => {
                    onSetFdrScale(scale.name);
                    onClose();
                  }}
                  type="button"
                >
                  <span aria-hidden="true" className="profile-fdr-scale-option__number">{scale.optionNumber}</span>
                  <span className="profile-fdr-scale-option__previews">
                    <FdrPaletteBar displayMode={fdrDisplayMode} mode={themeMode} reversed={fdrScaleReversed} scale={scale} customAnchors={customFdrAnchors} />
                  </span>
                  <span aria-hidden="true" className="profile-preset-check">{scale.name === fdrScale ? <Check size={15} /> : <Circle size={15} />}</span>
                </button>
              ))}
            </section>
          </div>
        </div>
      </Sheet>
    </>
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

function getFdrScaleOptionNumber(scaleName: FdrColourScale['name']): number | null {
  return getFdrColourScale(scaleName).optionNumber;
}

function FdrPalettePreview({
  displayMode,
  mode,
  reversed,
  scale,
  customAnchors,
}: {
  displayMode: FdrDisplayMode;
  mode: 'light' | 'dark';
  reversed: boolean;
  scale: FdrColourScale;
  customAnchors: FdrCustomAnchors;
}) {
  const palette = getFdrPalette(scale.name, mode, reversed, customAnchors);
  return (
    <div className="profile-fdr-preview" data-mode={mode}>
      <div className="profile-fdr-preview__header">
        <strong>{mode === 'light' ? 'Light theme' : 'Dark theme'}</strong>
        <small>{displayMode === 'font' ? 'Coloured font' : 'Coloured fill'}</small>
      </div>
      <FdrPaletteBar
        customAnchors={customAnchors}
        displayMode={displayMode}
        mode={mode}
        reversed={reversed}
        scale={scale}
      />
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
  customAnchors,
}: {
  displayMode: FdrDisplayMode;
  mode: 'light' | 'dark';
  reversed: boolean;
  scale: FdrColourScale;
  customAnchors: FdrCustomAnchors;
}) {
  const palette = getFdrDisplayPalette(scale.name, mode, reversed, displayMode, customAnchors);
  return (
    <span aria-label={scale.optionNumber ? `FDR colour scale option ${scale.optionNumber}` : scale.label} className="profile-fdr-palette-bar" data-display-mode={displayMode}>
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
  customAnchors: FdrCustomAnchors,
) {
  return displayMode === 'fill'
    ? getFdrFillPalette(name, mode, reversed, customAnchors)
    : getFdrPalette(name, mode, reversed, customAnchors);
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
  themeColour,
  onSelect,
}: {
  themeColour: string;
  onSelect: (colour: string) => void;
}) {
  return (
    <section aria-labelledby="main-theme-colour-title" className="profile-theme-colours">
      <div className="profile-theme-colours__header">
        <div>
          <strong id="main-theme-colour-title">Main theme colour</strong>
          <small>Choose one colour; light and dark variants are adjusted automatically.</small>
        </div>
      </div>
      <div className="profile-theme-colour-row" data-theme-colour-mode="shared">
        <div className="profile-theme-colour-row__copy">
          <strong>Shared accent</strong>
          <small>{themeColour}</small>
        </div>
        <div aria-label="Main theme colours" className="profile-theme-colour-options" role="group">
          {themeColourOptions.map((option) => (
            <button
              aria-label={`${option.label} theme colour`}
              aria-pressed={themeColour === option.colour}
              className={`profile-theme-colour-swatch${themeColour === option.colour ? ' is-selected' : ''}`}
              key={option.label}
              onClick={() => onSelect(option.colour)}
              style={{ '--swatch-colour': option.colour } as CSSProperties}
              title={option.label}
              type="button"
            />
          ))}
          <label className="profile-theme-colour-picker">
            <span className="sr-only">Choose a custom theme colour</span>
            <input
              aria-label="Custom theme colour"
              onChange={(event) => onSelect(event.target.value)}
              type="color"
              value={themeColour}
            />
          </label>
        </div>
      </div>
      <div className="profile-theme-colour-variants">
        <span style={{ '--swatch-colour': getThemeColourForMode(themeColour, 'light') } as CSSProperties}>Light {getThemeColourForMode(themeColour, 'light')}</span>
        <span style={{ '--swatch-colour': getThemeColourForMode(themeColour, 'dark') } as CSSProperties}>Dark {getThemeColourForMode(themeColour, 'dark')}</span>
      </div>
    </section>
  );
}

function CustomFdrScaleEditor({
  anchors,
  onChange,
  onSave,
  onUse,
  selectedScaleName,
}: {
  anchors: FdrCustomAnchors;
  onChange: (anchors: FdrCustomAnchors) => void;
  onSave: (palette: { name: string; mode: 'anchors' | 'all'; anchors: FdrCustomAnchors }) => Promise<FdrCustomPalette>;
  onUse: (scaleName: 'CustomHex' | 'CustomAll') => void;
  selectedScaleName: FdrColourScale['name'];
}) {
  const [mode, setMode] = useState<'anchors' | 'all'>(selectedScaleName === 'CustomAll' ? 'all' : 'anchors');
  const [activeKey, setActiveKey] = useState<CustomColourKey>('min');
  const [paletteName, setPaletteName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  useEffect(() => {
    setMode(selectedScaleName === 'CustomAll' ? 'all' : 'anchors');
  }, [selectedScaleName]);
  const editableKeys: CustomColourKey[] = mode === 'anchors' ? ['min', 'mid', 'max'] : [...customColourKeys];
  const selectedKey = editableKeys.includes(activeKey) ? activeKey : editableKeys[0];
  const activeColour = mode === 'anchors'
    ? getFdrFillPalette('CustomHex', 'light', false, anchors)[customColourKeys.indexOf(selectedKey)]
    : anchors[selectedKey];
  const hsv = hexToHsv(activeColour);

  const updateFromHsv = (next: HsvColour) => {
    onChange({ ...anchors, [selectedKey]: hsvToHex(next) });
  };

  const updateFieldFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const saturation = clamp((event.clientX - bounds.left) / bounds.width);
    const exposure = clamp(1 - ((event.clientY - bounds.top) / bounds.height));
    updateFromHsv({ ...hsv, saturation, exposure });
  };

  const updateHueFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const hue = clamp((event.clientX - bounds.left) / bounds.width) * 360;
    updateFromHsv({ ...hsv, hue });
  };

  const savePalette = async () => {
    const name = paletteName.trim();
    if (!name) {
      setSaveMessage('Give this palette a name first.');
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    try {
      await onSave({ name, mode, anchors });
      setPaletteName('');
      setSaveMessage('Palette saved.');
    } catch {
      setSaveMessage('The palette could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-fdr-custom-editor">
      <div className="profile-fdr-custom-editor__header">
        <div>
          <strong>Build your own scale</strong>
          <small>Use the colour field to tune saturation and exposure, then choose exactly which FDR levels are editable.</small>
        </div>
        <div className="profile-fdr-custom-editor__actions">
          <Button onClick={() => onUse(mode === 'all' ? 'CustomAll' : 'CustomHex')} type="button" variant="secondary">
            Use {mode === 'all' ? 'every colour' : '1 / 3 / 5'}
          </Button>
        </div>
      </div>
      <div aria-label="Custom FDR scale mode" className="profile-fdr-custom-editor__modes" role="group">
        <button
          aria-pressed={mode === 'anchors'}
          className={`profile-fdr-custom-editor__mode${mode === 'anchors' ? ' is-selected' : ''}`}
          onClick={() => setMode('anchors')}
          type="button"
        >
          <strong>Custom 1 / 3 / 5</strong>
          <small>Levels 2 and 4 interpolate automatically.</small>
        </button>
        <button
          aria-pressed={mode === 'all'}
          className={`profile-fdr-custom-editor__mode${mode === 'all' ? ' is-selected' : ''}`}
          onClick={() => setMode('all')}
          type="button"
        >
          <strong>Custom every colour</strong>
          <small>Choose all five FDR colours independently.</small>
        </button>
      </div>
      <div aria-label="Custom FDR colours" className="profile-fdr-custom-editor__inputs" role="group">
        {customColourKeys.map((key, index) => {
          const isEditable = editableKeys.includes(key);
          const colour = mode === 'anchors'
            ? getFdrFillPalette('CustomHex', 'light', false, anchors)[index]
            : anchors[key];
          return (
            <button
              aria-label={`Edit FDR ${index + 1} colour`}
              aria-pressed={isEditable && key === selectedKey}
              className={`profile-fdr-custom-editor__level${key === selectedKey ? ' is-selected' : ''}${!isEditable ? ' is-interpolated' : ''}`}
              disabled={!isEditable}
              key={key}
              onClick={() => setActiveKey(key)}
              style={{ '--level-colour': colour, '--level-foreground': getFdrFillForeground(colour) } as CSSProperties}
              type="button"
            >
              <span>{index + 1}</span>
              <small>{isEditable ? colour : 'Auto'}</small>
            </button>
          );
        })}
      </div>
      <div
        aria-label={`Colour field for FDR ${customColourKeys.indexOf(selectedKey) + 1}`}
        className="profile-fdr-colour-picker__field"
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
          className="profile-fdr-colour-picker__field-pointer"
          style={{ left: `${hsv.saturation * 100}%`, top: `${(1 - hsv.exposure) * 100}%` }}
        />
      </div>
      <div
        aria-label="All colours hue selector"
        className="profile-fdr-colour-picker__hue"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateHueFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons > 0) updateHueFromPointer(event);
        }}
      >
        <span aria-hidden="true" className="profile-fdr-colour-picker__hue-pointer" style={{ left: `${(hsv.hue / 360) * 100}%` }} />
      </div>
      <div className="profile-fdr-colour-picker__sliders">
        <label>
          <span>Saturation <strong>{Math.round(hsv.saturation * 100)}%</strong></span>
          <input
            aria-label={`Saturation for FDR ${customColourKeys.indexOf(selectedKey) + 1}`}
            max="100"
            min="0"
            onChange={(event) => updateFromHsv({ ...hsv, saturation: Number(event.target.value) / 100 })}
            type="range"
            value={Math.round(hsv.saturation * 100)}
          />
        </label>
        <label>
          <span>Exposure <strong>{Math.round(hsv.exposure * 100)}%</strong></span>
          <input
            aria-label={`Exposure for FDR ${customColourKeys.indexOf(selectedKey) + 1}`}
            max="100"
            min="0"
            onChange={(event) => updateFromHsv({ ...hsv, exposure: Number(event.target.value) / 100 })}
            type="range"
            value={Math.round(hsv.exposure * 100)}
          />
        </label>
      </div>
      <div className="profile-fdr-custom-editor__save">
        <label>
          <span>Palette name</span>
          <input
            aria-label="Saved FDR palette name"
            maxLength={80}
            onChange={(event) => {
              setPaletteName(event.target.value);
              setSaveMessage(null);
            }}
            placeholder="e.g. Weekend watch"
            type="text"
            value={paletteName}
          />
        </label>
        <Button disabled={isSaving} onClick={() => void savePalette()} type="button" variant="secondary">
          {isSaving ? 'Saving…' : 'Save palette'}
        </Button>
        {saveMessage ? <small aria-live="polite" role="status">{saveMessage}</small> : null}
      </div>
      <FdrPaletteBar
        customAnchors={anchors}
        displayMode="fill"
        mode="light"
        reversed={false}
        scale={getFdrColourScale(mode === 'all' ? 'CustomAll' : 'CustomHex')}
      />
    </div>
  );
}

function SavedFdrPaletteOption({
  onDelete,
  onUse,
  palette,
}: {
  onDelete: () => Promise<void>;
  onUse: () => void;
  palette: FdrCustomPalette;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(false);
  const scaleName = palette.mode === 'all' ? 'CustomAll' : 'CustomHex';

  return (
    <div className="profile-fdr-saved-palette">
      <div className="profile-fdr-saved-palette__preview">
        <div>
          <strong>{palette.name}</strong>
          <small>{palette.mode === 'all' ? 'Every colour editable' : 'Levels 1, 3 and 5 editable'}</small>
        </div>
        <FdrPaletteBar
          customAnchors={palette.anchors}
          displayMode="fill"
          mode="light"
          reversed={false}
          scale={getFdrColourScale(scaleName)}
        />
      </div>
      <div className="profile-fdr-saved-palette__actions">
        <Button onClick={onUse} type="button" variant="secondary">Use</Button>
        <Button
          aria-label={`Delete saved FDR palette ${palette.name}`}
          disabled={isDeleting}
          onClick={() => {
            setIsDeleting(true);
            setError(false);
            void onDelete()
              .catch(() => setError(true))
              .finally(() => setIsDeleting(false));
          }}
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" size={16} />
          {isDeleting ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
      {error ? <small aria-live="polite" className="profile-fdr-saved-palette__error" role="alert">Could not delete this palette.</small> : null}
    </div>
  );
}

const customColourKeys = ['min', 'second', 'mid', 'fourth', 'max'] as const;
type CustomColourKey = typeof customColourKeys[number];
interface HsvColour {
  hue: number;
  saturation: number;
  exposure: number;
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
