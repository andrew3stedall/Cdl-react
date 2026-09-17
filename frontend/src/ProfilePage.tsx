import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  ChevronRight,
  Circle,
  Fingerprint,
  Mail,
  Moon,
  Sun,
  Type,
  PaintBucket,
  Palette,
  Trash2,
  LampDesk,
  UserRound,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Sheet } from './components/ui/sheet';
import { PlayerCard } from './components/player/PlayerCard';
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
import {
  getMetricColourScale,
  getMetricPalette,
  getCustomMetricColourScale,
  getCustomPositionColourScale,
  getPositionColourScale,
  metricColourScales,
  positionColourModes,
  positionColourScales,
  resolveMetricPalette,
  resolvePositionPalette,
  type MetricPalette,
  type MetricColourScaleName,
  type PlayerColourPalette,
  type PositionColourMode,
  type PositionPalette,
  type PositionColourScaleName,
} from './player-colour-scales';
import { getThemeMode, themePresets } from './theme-presets';
import { useThemePreset } from './theme-preset-provider';
import {
  getThemeColourForMode,
  themeColourOptions,
  type ThemeAccent,
  type ThemeAccentColours,
} from './theme-colours';
import { getPasskeyStatus, registerPasskey, type PasskeyStatus } from './passkeys';
import { getResultColourPaletteLabel } from './result-colours';
import { managerNicknameForName } from './manager-nicknames';
import { GlobalPageHeader } from './components/ui/global-notifications';
import { PageHero, PageHeroControls, PageHeroViewToggle } from './components/ui/page-hero';
import { ColourPaletteSelector } from './components/ui/colour-palette-selector';
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
    positionColourScale,
    positionColourMode,
    positionCustomColours,
    metricColourScale,
    metricColourScaleReversed,
    metricCustomColours,
    resultColours,
    customPlayerColourPalettes,
    themeColours,
    preset,
    saveStatus,
    setAttackDirection,
    setFdrDisplayMode,
    setFdrScale,
    setFdrScaleReversed,
    setCustomFdrAnchors,
    saveCustomFdrPalette,
    deleteCustomFdrPalette,
    setPositionColourScale,
    setPositionColourMode,
    useCustomPositionColours,
    setMetricColourScale,
    setMetricColourScaleReversed,
    useCustomMetricColours,
    savePlayerColourPalette,
    deletePlayerColourPalette,
    useCustomFdrPalette,
    setThemeAccentColour,
    setPresetName,
  } = useThemePreset();
  const [isFdrScaleSheetOpen, setIsFdrScaleSheetOpen] = useState(false);
  const [isPositionScaleSheetOpen, setIsPositionScaleSheetOpen] = useState(false);
  const [isMetricScaleSheetOpen, setIsMetricScaleSheetOpen] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState<PasskeyStatus | null>(null);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);
  const isAccountSummary = currentPath === '/account' || currentPath === '/profile';
  const isAppearancePage = currentPath === '/account/appearance' || currentPath === '/profile/appearance';
  const isFdrPage = currentPath === '/account/fdr' || currentPath === '/profile/fdr';
  const isOrientationPage = currentPath === '/account/orientation' || currentPath === '/profile/orientation';
  const isPositionColoursPage = currentPath === '/account/player-positions' || currentPath === '/profile/player-positions';
  const isMetricColoursPage = currentPath === '/account/player-metrics' || currentPath === '/profile/player-metrics';

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
    if (!isFdrScaleSheetOpen && !isPositionScaleSheetOpen && !isMetricScaleSheetOpen) return undefined;

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
  }, [isFdrScaleSheetOpen, isMetricScaleSheetOpen, isPositionScaleSheetOpen]);

  const user = session.user;
  const selectedFdrScale = getFdrColourScale(fdrScale);
  const selectedFdrScaleNumber = getFdrScaleOptionNumber(fdrScale);
  const themeMode = getThemeMode(preset);
  const displayName = managerNicknameForName(user?.displayName) ?? 'Authenticated user';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CD';

  if (isAppearancePage) {
    return (
      <main aria-labelledby="account-settings-title" className="feature-screen profile-page profile-page--subpage">
        <SettingsPageHeader onBack={() => onNavigate('/profile')} onNavigate={onNavigate} title="Visual preset" />
        <AppearanceSettingsCard
          preset={preset}
          saveStatus={saveStatus}
          setPresetName={setPresetName}
          setThemeAccentColour={setThemeAccentColour}
          themeColours={themeColours}
        />
      </main>
    );
  }

  if (isFdrPage) {
    return (
      <main aria-labelledby="account-settings-title" className="feature-screen profile-page profile-page--subpage">
        <SettingsPageHeader onBack={() => onNavigate('/profile')} onNavigate={onNavigate} title="FDR colour scale" />
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
        <SettingsPageHeader onBack={() => onNavigate('/profile')} onNavigate={onNavigate} title="Attacking orientation" />
        <PitchSettingsCard attackDirection={attackDirection} onSetAttackDirection={setAttackDirection} />
      </main>
    );
  }

  if (isPositionColoursPage) {
    return (
      <main aria-labelledby="account-settings-title" className="feature-screen profile-page profile-page--subpage">
        <SettingsPageHeader onBack={() => onNavigate('/profile')} onNavigate={onNavigate} title="Position colours" />
        <PositionColourSettingsCard
          customPalettes={customPlayerColourPalettes}
          isScaleSheetOpen={isPositionScaleSheetOpen}
          onCloseSheet={() => setIsPositionScaleSheetOpen(false)}
          onDeletePalette={deletePlayerColourPalette}
          onOpenSheet={() => setIsPositionScaleSheetOpen(true)}
          onSavePalette={savePlayerColourPalette}
          onSetMode={setPositionColourMode}
          onSetPositionColourScale={setPositionColourScale}
          onUseCustomColours={useCustomPositionColours}
          positionColourMode={positionColourMode}
          positionCustomColours={positionCustomColours}
          positionColourScale={positionColourScale}
        />
      </main>
    );
  }

  if (isMetricColoursPage) {
    return (
      <main aria-labelledby="account-settings-title" className="feature-screen profile-page profile-page--subpage">
        <SettingsPageHeader onBack={() => onNavigate('/profile')} onNavigate={onNavigate} title="Metric colours" />
        <MetricColourSettingsCard
          customPalettes={customPlayerColourPalettes}
          isScaleSheetOpen={isMetricScaleSheetOpen}
          metricColourScale={metricColourScale}
          metricColourScaleReversed={metricColourScaleReversed}
          metricCustomColours={metricCustomColours}
          mode={themeMode}
          onCloseSheet={() => setIsMetricScaleSheetOpen(false)}
          onDeletePalette={deletePlayerColourPalette}
          onOpenSheet={() => setIsMetricScaleSheetOpen(true)}
          onSavePalette={savePlayerColourPalette}
          onSetMetricColourScale={setMetricColourScale}
          onSetMetricColourScaleReversed={setMetricColourScaleReversed}
          onUseCustomColours={useCustomMetricColours}
        />
      </main>
    );
  }

  return (
    <main aria-labelledby="profile-title" className="feature-screen profile-page profile-page--summary">
      <PageHero
        actions={(
          <PageHeroControls>
            <PageHeroViewToggle
              ariaLabel="Desk and profile"
              onChange={(nextPage) => {
                if (nextPage === 'desk') onNavigate('/dashboard');
              }}
              options={[
                { value: 'desk', label: 'Desk', icon: <LampDesk aria-hidden="true" size={17} /> },
                { value: 'profile', label: 'Profile', icon: <UserRound aria-hidden="true" size={17} /> },
              ]}
              value="profile"
            />
          </PageHeroControls>
        )}
        actionsLabel="Profile utilities"
        onNavigate={onNavigate}
        title="Profile"
        titleId="profile-title"
      />
      <div className="profile-settings-groups">
        <ProfileSettingsGroup cardClassName="profile-user-details-card" title="My profile" titleId="profile-user-details-title">
          <div className="profile-user-details__summary">
            <span aria-hidden="true" className="profile-avatar">{initials}</span>
            <div>
              <h3>{displayName}</h3>
              <p>{user?.email ?? 'No email address available'}</p>
            </div>
          </div>
          <dl className="profile-user-details__list">
            <div className="profile-user-details__row">
              <span aria-hidden="true" className="profile-user-details__icon"><UserRound size={17} /></span>
              <dt>Display name</dt>
              <dd>{displayName}</dd>
            </div>
            <div className="profile-user-details__row">
              <span aria-hidden="true" className="profile-user-details__icon"><Mail size={17} /></span>
              <dt>Email address</dt>
              <dd>{user?.email ?? 'Not available'}</dd>
            </div>
          </dl>
          {passkeyStatus?.enabled && passkeyStatus.registeredCount === 0 ? (
            <div className="profile-settings-row profile-settings-row--static profile-security-card">
              <span aria-hidden="true" className="profile-settings-row__icon"><Fingerprint size={20} /></span>
              <span className="profile-settings-row__copy">
                <strong>Device sign-in</strong>
                <small>Use Face ID or fingerprint</small>
              </span>
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
                {passkeyPending ? 'Waiting…' : 'Enable'}
              </Button>
              {passkeyMessage ? <span aria-live="polite" className="profile-settings-row__status" role="status">{passkeyMessage}</span> : null}
            </div>
          ) : null}
        </ProfileSettingsGroup>

        <ProfileSettingsGroup title="Appearance">
          <ProfileSettingsRow
            ariaLabel="Open workspace appearance settings"
            icon={<AppearanceIcon preset={preset} />}
            label="Appearance"
            onSelect={() => onNavigate('/profile/appearance')}
            value={preset.label + ' · 3 accent colours'}
          />
        </ProfileSettingsGroup>

        <ProfileSettingsGroup title="Player cards">
          <ProfileSettingsRow
            ariaLabel="Open player position colour settings"
            icon={<Palette aria-hidden="true" size={20} />}
            label="Position colours"
            onSelect={() => onNavigate('/profile/player-positions')}
            value={`${positionColourScale === 'Custom' ? 'Custom' : getPositionColourScale(positionColourScale).label} · ${positionColourMode.replace('-', ' ')}`}
          />
          <ProfileSettingsRow
            ariaLabel="Open player metric colour settings"
            icon={<BarChart3 aria-hidden="true" size={20} />}
            label="Metric heatmap"
            onSelect={() => onNavigate('/profile/player-metrics')}
            value={`${metricColourScale === 'Custom' ? 'Custom' : getMetricColourScale(metricColourScale).label} · ${metricColourScaleReversed ? 'Reversed' : 'Low to high'}`}
          />
        </ProfileSettingsGroup>

        <ProfileSettingsGroup title="Fixtures">
          <ProfileSettingsRow
            ariaLabel="Open result colour settings"
            icon={<Circle aria-hidden="true" size={20} />}
            label="Result colours"
            onSelect={() => onNavigate('/profile/result-colours')}
            value={`${getResultColourPaletteLabel(resultColours)} · Win / Draw / Loss`}
          />
          <ProfileSettingsRow
            ariaLabel="Open FDR colour scale settings"
            icon={<BarChart3 aria-hidden="true" size={20} />}
            label="FDR colour scale"
            onSelect={() => onNavigate('/profile/fdr')}
            value={`${selectedFdrScaleNumber ? `Option ${selectedFdrScaleNumber}` : selectedFdrScale.label} · ${fdrDisplayMode === 'fill' ? 'Coloured fill' : 'Coloured font'}`}
          />
        </ProfileSettingsGroup>

        <ProfileSettingsGroup title="Squad display">
          <ProfileSettingsRow
            ariaLabel={`Current attacking orientation: attack ${attackDirection === 'up' ? 'upwards' : 'downwards'}. Open settings.`}
            icon={attackDirection === 'up' ? <ArrowUp aria-hidden="true" size={20} /> : <ArrowDown aria-hidden="true" size={20} />}
            label="Attacking direction"
            onSelect={() => onNavigate('/profile/orientation')}
            value={attackDirection === 'up' ? 'Attack upwards' : 'Attack downwards'}
          />
        </ProfileSettingsGroup>
      </div>
    </main>
  );
}

function SettingsPageHeader({ onBack, onNavigate, title }: { onBack: () => void; onNavigate: (href: string) => void; title: string }) {
  return (
    <GlobalPageHeader className="profile-page__header profile-page__header--subpage" onNavigate={onNavigate}>
      <button className="profile-subpage-back" onClick={onBack} type="button">
        <ArrowLeft aria-hidden="true" size={17} />
        Profile
      </button>
      <p className="eyebrow">Profile</p>
      <h1 id="account-settings-title">{title}</h1>
    </GlobalPageHeader>
  );
}

function ProfileSettingsGroup({ cardClassName, children, title, titleId }: { cardClassName?: string; children: ReactNode; title: string; titleId?: string }) {
  const headingId = titleId ?? `profile-settings-group-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={headingId} className="profile-settings-group">
      <h2 id={headingId}>{title}</h2>
      <Card className={`profile-settings-group__card${cardClassName ? ` ${cardClassName}` : ''}`}>{children}</Card>
    </section>
  );
}

function ProfileSettingsRow({ ariaLabel, icon, label, onSelect, value }: { ariaLabel: string; icon: ReactNode; label: string; onSelect: () => void; value: string }) {
  return (
    <button aria-label={ariaLabel} className="profile-settings-row profile-settings-row--button" onClick={onSelect} type="button">
      <span aria-hidden="true" className="profile-settings-row__icon">{icon}</span>
      <span className="profile-settings-row__copy">
        <strong>{label}</strong>
        <small>{value}</small>
      </span>
      <ChevronRight aria-hidden="true" className="profile-settings-row__chevron" size={19} />
    </button>
  );
}

function PositionColourSettingsCard({
  customPalettes,
  isScaleSheetOpen,
  onCloseSheet,
  onDeletePalette,
  onOpenSheet,
  onSavePalette,
  onSetMode,
  onSetPositionColourScale,
  onUseCustomColours,
  positionColourMode,
  positionCustomColours,
  positionColourScale,
}: {
  customPalettes: PlayerColourPalette[];
  isScaleSheetOpen: boolean;
  onCloseSheet: () => void;
  onDeletePalette: (paletteId: string) => Promise<void>;
  onOpenSheet: () => void;
  onSavePalette: (palette: Omit<PlayerColourPalette, 'id'>) => Promise<PlayerColourPalette>;
  onSetMode: (mode: PositionColourMode) => void;
  onSetPositionColourScale: (scale: PositionColourScaleName) => void;
  onUseCustomColours: (colours: PositionPalette) => void;
  positionColourMode: PositionColourMode;
  positionCustomColours: PositionPalette;
  positionColourScale: PositionColourScaleName;
}) {
  return (
    <Card className="profile-card profile-player-colours-card profile-settings-card">
      <div className="profile-card__header">
        <div>
          <p className="profile-card__eyebrow">Player positions</p>
          <h2>Position colours</h2>
        </div>
        <Palette aria-hidden="true" className="profile-appearance-icon" size={21} />
      </div>
      <Button aria-controls="position-colour-sheet" aria-expanded={isScaleSheetOpen} className="profile-fdr-scale-trigger" onClick={onOpenSheet} type="button" variant="secondary">
        <span>
          <strong>{positionColourScale === 'Custom' ? 'Custom' : getPositionColourScale(positionColourScale).label}</strong>
          <small>Four position colours</small>
        </span>
        <ChevronRight aria-hidden="true" size={18} />
      </Button>
      <PositionPaletteBar customColours={positionCustomColours} positionColourScale={positionColourScale} />
      <div aria-label="Position colour application" className="profile-position-colour-modes" role="group">
        {positionColourModes.map((option) => (
          <button aria-pressed={option.name === positionColourMode} className={`profile-position-colour-mode${option.name === positionColourMode ? ' is-selected' : ''}`} key={option.name} onClick={() => onSetMode(option.name)} type="button">
            <span className="profile-position-colour-mode__icon" aria-hidden="true">
              {option.name === 'name-font' ? <Type size={16} /> : option.name === 'name-fill' ? <PaintBucket size={16} /> : option.name === 'card-border' ? <Circle size={16} /> : <Palette size={16} />}
            </span>
            <span><strong>{option.label}</strong></span>
            <span aria-hidden="true" className="profile-preset-check">{option.name === positionColourMode ? <Check size={15} /> : <Circle size={15} />}</span>
          </button>
        ))}
      </div>
      <section aria-label="Example player card" className="profile-position-player-card-preview">
        <div className="profile-position-player-card-preview__copy">
          <strong>Live player card preview</strong>
        </div>
        <div className="profile-position-player-card-preview__stage">
          <PlayerCard
            ariaLabel="Ndombele example midfielder player card"
            layout="token"
            player={{
              displayName: 'Ndombele',
              fixtures: [{ difficulty: 4, label: 'liv', title: 'Liverpool away' }],
              form: 7.4,
              position: 'MID',
              team: 'TOT',
            }}
            size="lg"
          />
        </div>
      </section>
      <PlayerColourPaletteChooser
        customColours={Object.values(positionCustomColours)}
        customPalettes={customPalettes}
        family="position"
        isOpen={isScaleSheetOpen}
        onClose={onCloseSheet}
        onDeletePalette={onDeletePalette}
        onSavePalette={onSavePalette}
        onSetScale={(scale) => onSetPositionColourScale(scale as PositionColourScaleName)}
        onUseCustomColours={(colours) => onUseCustomColours(resolvePositionPalette({ GKP: colours[0], DEF: colours[1], MID: colours[2], FWD: colours[3] }))}
        selectedScale={positionColourScale}
      />
    </Card>
  );
}

function MetricColourSettingsCard({
  customPalettes,
  isScaleSheetOpen,
  metricColourScale,
  metricColourScaleReversed,
  metricCustomColours,
  mode,
  onCloseSheet,
  onDeletePalette,
  onOpenSheet,
  onSavePalette,
  onSetMetricColourScale,
  onSetMetricColourScaleReversed,
  onUseCustomColours,
}: {
  customPalettes: PlayerColourPalette[];
  isScaleSheetOpen: boolean;
  metricColourScale: MetricColourScaleName;
  metricColourScaleReversed: boolean;
  metricCustomColours: MetricPalette;
  mode: 'light' | 'dark';
  onCloseSheet: () => void;
  onDeletePalette: (paletteId: string) => Promise<void>;
  onOpenSheet: () => void;
  onSavePalette: (palette: Omit<PlayerColourPalette, 'id'>) => Promise<PlayerColourPalette>;
  onSetMetricColourScale: (scale: MetricColourScaleName) => void;
  onSetMetricColourScaleReversed: (reversed: boolean) => void;
  onUseCustomColours: (colours: MetricPalette) => void;
}) {
  return (
    <Card className="profile-card profile-player-colours-card profile-settings-card">
      <div className="profile-card__header">
        <div>
          <p className="profile-card__eyebrow">Player metrics</p>
          <h2>Metric heatmap</h2>
        </div>
        <BarChart3 aria-hidden="true" className="profile-appearance-icon" size={21} />
      </div>
      <Button aria-controls="metric-colour-sheet" aria-expanded={isScaleSheetOpen} className="profile-fdr-scale-trigger" onClick={onOpenSheet} type="button" variant="secondary">
        <span>
          <strong>{metricColourScale === 'Custom' ? 'Custom' : getMetricColourScale(metricColourScale).label}</strong>
          <small>Five heatmap steps</small>
        </span>
        <ChevronRight aria-hidden="true" size={18} />
      </Button>
      <MetricPaletteBar customColours={metricCustomColours} metricColourScale={metricColourScale} metricColourScaleReversed={metricColourScaleReversed} mode={mode} />
      <ProfileSettingsSwitch
        checked={metricColourScaleReversed}
        className="profile-fdr-reverse-toggle"
        label="Reverse order"
        onChange={onSetMetricColourScaleReversed}
      />
      <PlayerColourPaletteChooser
        customColours={[...metricCustomColours]}
        customPalettes={customPalettes}
        family="metric"
        isOpen={isScaleSheetOpen}
        mode={mode}
        onClose={onCloseSheet}
        onDeletePalette={onDeletePalette}
        onSavePalette={onSavePalette}
        onSetScale={(scale) => onSetMetricColourScale(scale as MetricColourScaleName)}
        onUseCustomColours={(colours) => onUseCustomColours(resolveMetricPalette(colours))}
        selectedScale={metricColourScale}
      />
    </Card>
  );
}

function PositionPaletteBar({ positionColourScale, customColours }: { positionColourScale: PositionColourScaleName; customColours?: PositionPalette }) {
  const palette = positionColourScale === 'Custom' ? getCustomPositionColourScale(customColours) : getPositionColourScale(positionColourScale);
  return (
    <span aria-label={`${palette.label} position colour scale`} className="profile-position-palette-bar">
      {(['GKP', 'DEF', 'MID', 'FWD'] as const).map((position) => (
        <span key={position} style={{ '--position-colour': palette.positions[position] } as CSSProperties}>{position}</span>
      ))}
    </span>
  );
}

function MetricPaletteBar({
  customColours,
  metricColourScale,
  metricColourScaleReversed,
  mode,
}: {
  metricColourScale: MetricColourScaleName;
  metricColourScaleReversed: boolean;
  mode: 'light' | 'dark';
  customColours?: MetricPalette;
}) {
  const palette = metricColourScale === 'Custom' ? getCustomMetricColourScale(customColours) : getMetricColourScale(metricColourScale);
  return (
    <span aria-label={`${palette.label} heatmap metric colour scale`} className="profile-metric-palette-bar">
      {getMetricPalette(metricColourScale, mode, metricColourScaleReversed, customColours).map((colour, index) => (
        <span key={`${metricColourScale}-${mode}-${index}`} style={{ backgroundColor: colour }} />
      ))}
    </span>
  );
}

function PlayerColourPaletteChooser({
  customColours,
  customPalettes,
  family,
  isOpen,
  mode = 'light',
  onClose,
  onDeletePalette,
  onSavePalette,
  onSetScale,
  onUseCustomColours,
  selectedScale,
}: {
  customColours: string[];
  customPalettes: PlayerColourPalette[];
  family: 'position' | 'metric';
  isOpen: boolean;
  mode?: 'light' | 'dark';
  onClose: () => void;
  onDeletePalette: (paletteId: string) => Promise<void>;
  onSavePalette: (palette: Omit<PlayerColourPalette, 'id'>) => Promise<PlayerColourPalette>;
  onSetScale: (scale: PositionColourScaleName | MetricColourScaleName) => void;
  onUseCustomColours: (colours: string[]) => void;
  selectedScale: PositionColourScaleName | MetricColourScaleName;
}) {
  const isPosition = family === 'position';
  const presets = isPosition ? positionColourScales : metricColourScales;
  const savedPalettes = customPalettes.filter((palette) => palette.family === family);
  const title = isPosition ? 'Position colours' : 'Metric heatmap colours';
  const selectedLabel = selectedScale === 'Custom' ? 'Custom' : presets.find((scale) => scale.name === selectedScale)?.label ?? selectedScale;
  const [isCustomOpen, setIsCustomOpen] = useState(selectedScale === 'Custom');
  useEffect(() => setIsCustomOpen(selectedScale === 'Custom'), [selectedScale]);

  return (
    <>
      {isOpen ? <button aria-label={`Close ${title} chooser`} className="profile-fdr-sheet-backdrop" onClick={onClose} type="button" /> : null}
      <Sheet id={isPosition ? 'position-colour-sheet' : 'metric-colour-sheet'} isOpen={isOpen} labelledBy={`${family}-colour-sheet-title`}>
        <div className="profile-fdr-sheet profile-player-colour-sheet">
          <header className="profile-fdr-sheet__header">
            <div>
              <p className="profile-card__eyebrow">{title}</p>
              <h2 id={`${family}-colour-sheet-title`}>Choose a palette</h2>
            </div>
            <Button aria-label={`Close ${title} chooser`} className="profile-fdr-sheet__close" onClick={onClose} type="button" variant="ghost">
              <X aria-hidden="true" size={18} />
            </Button>
          </header>
          <div className="profile-fdr-scale-list">
            <section aria-labelledby={`${family}-preset-heading`}>
              <h3 className="profile-fdr-custom-heading" id={`${family}-preset-heading`}>Presets</h3>
              <div aria-label={`${isPosition ? 'Position' : 'Metric'} colour scales`} className="profile-player-colour-options" role="group">
                {presets.map((scale) => (
                  <button
                    aria-pressed={scale.name === selectedScale}
                    className={`profile-player-colour-option${scale.name === selectedScale ? ' is-selected' : ''}`}
                    key={scale.name}
                    onClick={() => {
                      onSetScale(scale.name);
                      onClose();
                    }}
                    type="button"
                  >
                    {isPosition
                      ? <PositionPaletteBar positionColourScale={scale.name as PositionColourScaleName} />
                      : <MetricPaletteBar metricColourScale={scale.name as MetricColourScaleName} metricColourScaleReversed={false} mode={mode} />}
                    <span><strong>{scale.label}</strong></span>
                    <span aria-hidden="true" className="profile-preset-check">{scale.name === selectedScale ? <Check size={15} /> : <Circle size={15} />}</span>
                  </button>
                ))}
              </div>
            </section>
            <details className="profile-colour-accordion" id={`${family}-custom-accordion`} onToggle={(event) => setIsCustomOpen(event.currentTarget.open)} open={isCustomOpen}>
              <summary className="profile-colour-accordion__summary">Custom palette</summary>
              <div className="profile-colour-accordion__content">
                <CustomPlayerColourEditor
                  family={family}
                  initialColours={customColours}
                  onSave={(palette) => onSavePalette(palette)}
                  onUse={(colours) => {
                    onUseCustomColours(colours);
                    onClose();
                  }}
                />
                {savedPalettes.length ? (
                  <div aria-label={`Saved custom ${family} palettes`} className="profile-player-saved-palettes">
                    <div className="profile-fdr-saved-palettes__header">
                      <h4>Saved palettes</h4>
                    </div>
                    {savedPalettes.map((palette) => (
                      <SavedPlayerColourPalette
                        key={palette.id}
                        onDelete={() => onDeletePalette(palette.id)}
                        onUse={() => {
                          onUseCustomColours(palette.colours);
                          onClose();
                        }}
                        palette={palette}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
          </div>
          <span className="sr-only">Current palette: {selectedLabel}</span>
        </div>
      </Sheet>
    </>
  );
}

function CustomPlayerColourEditor({
  family,
  initialColours,
  onSave,
  onUse,
}: {
  family: 'position' | 'metric';
  initialColours: string[];
  onSave: (palette: Omit<PlayerColourPalette, 'id'>) => Promise<PlayerColourPalette>;
  onUse: (colours: string[]) => void;
}) {
  const [colours, setColours] = useState(() => [...initialColours]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hsv, setHsv] = useState(() => hexToHsv(initialColours[0] ?? '#2563EB'));
  const [paletteName, setPaletteName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const labels = family === 'position' ? ['GKP', 'DEF', 'MID', 'FWD'] : ['Low', 'Lower', 'Mid', 'Higher', 'High'];

  const updateColours = (nextHsv: HsvColour) => {
    const nextColours = [...colours];
    nextColours[selectedIndex] = hsvToHex(nextHsv);
    setColours(nextColours);
    setHsv(nextHsv);
  };

  const selectColour = (index: number) => {
    setSelectedIndex(index);
    setHsv(hexToHsv(colours[index] ?? '#2563EB'));
  };

  const updateFieldFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    updateColours({ ...hsv, saturation: clamp((event.clientX - bounds.left) / bounds.width), exposure: clamp(1 - ((event.clientY - bounds.top) / bounds.height)) });
  };

  const updateHueFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    updateColours({ ...hsv, hue: clamp((event.clientX - bounds.left) / bounds.width) * 360 });
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
      await onSave({ name, family, colours });
      setPaletteName('');
      setSaveMessage('Palette saved.');
    } catch {
      setSaveMessage('The palette could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`profile-fdr-custom-editor profile-player-custom-editor profile-player-custom-editor--${family}`}>
      <div className="profile-fdr-custom-editor__header">
        <Button onClick={() => onUse(colours)} type="button" variant="secondary">Use custom</Button>
      </div>
      <div aria-label={`Colour field for ${family} ${labels[selectedIndex]}`} className="profile-fdr-colour-picker__field" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateFieldFromPointer(event); }} onPointerMove={(event) => { if (event.buttons > 0) updateFieldFromPointer(event); }} style={{ '--picker-hue': `${hsv.hue}deg` } as CSSProperties}>
        <span aria-hidden="true" className="profile-fdr-colour-picker__field-pointer" style={{ left: `${hsv.saturation * 100}%`, top: `${(1 - hsv.exposure) * 100}%` }} />
      </div>
      <div aria-label={`${family} palette hue selector`} className="profile-fdr-colour-picker__hue" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateHueFromPointer(event); }} onPointerMove={(event) => { if (event.buttons > 0) updateHueFromPointer(event); }}>
        <span aria-hidden="true" className="profile-fdr-colour-picker__hue-pointer" style={{ left: `${(hsv.hue / 360) * 100}%` }} />
      </div>
      <div className="profile-fdr-colour-picker__sliders">
        <label>
          <span>Saturation <strong>{Math.round(hsv.saturation * 100)}%</strong></span>
          <input aria-label={`Saturation for ${family} ${labels[selectedIndex]}`} max="100" min="0" onChange={(event) => updateColours({ ...hsv, saturation: Number(event.target.value) / 100 })} type="range" value={Math.round(hsv.saturation * 100)} />
        </label>
        <label>
          <span>Exposure <strong>{Math.round(hsv.exposure * 100)}%</strong></span>
          <input aria-label={`Exposure for ${family} ${labels[selectedIndex]}`} max="100" min="0" onChange={(event) => updateColours({ ...hsv, exposure: Number(event.target.value) / 100 })} type="range" value={Math.round(hsv.exposure * 100)} />
        </label>
      </div>
      <div className="profile-fdr-custom-editor__save">
        <label>
          <span>Palette name</span>
          <input aria-label={`Saved ${family} palette name`} maxLength={80} onChange={(event) => { setPaletteName(event.target.value); setSaveMessage(null); }} placeholder="e.g. Weekend watch" type="text" value={paletteName} />
        </label>
        <Button disabled={isSaving} onClick={() => void savePalette()} type="button" variant="secondary">{isSaving ? 'Saving…' : 'Save palette'}</Button>
        {saveMessage ? <small aria-live="polite" role="status">{saveMessage}</small> : null}
      </div>
      <ColourPaletteSelector
        ariaLabel={`Custom ${family} colours`}
        columns={colours.length}
        onSelect={(id) => selectColour(Number(id))}
        options={colours.map((colour, index) => ({
          ariaLabel: `Edit ${family} ${labels[index]} colour`,
          colour,
          foregroundColor: getFdrFillForeground(colour),
          id: String(index),
          label: labels[index],
        }))}
        selectedId={String(selectedIndex)}
      />
    </div>
  );
}

function SavedPlayerColourPalette({ onDelete, onUse, palette }: { onDelete: () => Promise<void>; onUse: () => void; palette: PlayerColourPalette }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="profile-fdr-saved-palette profile-player-saved-palette">
      <div className="profile-fdr-saved-palette__preview">
        <div><strong>{palette.name}</strong><small>{palette.family === 'position' ? 'Four positions' : 'Five heatmap steps'}</small></div>
        {palette.family === 'position'
          ? <PositionPaletteBar customColours={resolvePositionPalette({ GKP: palette.colours[0], DEF: palette.colours[1], MID: palette.colours[2], FWD: palette.colours[3] })} positionColourScale="Custom" />
          : <MetricPaletteBar customColours={resolveMetricPalette(palette.colours)} metricColourScale="Custom" metricColourScaleReversed={false} mode="light" />}
      </div>
      <div className="profile-fdr-saved-palette__actions">
        <Button onClick={onUse} type="button" variant="secondary">Use</Button>
        <Button aria-label={`Delete saved ${palette.family} palette ${palette.name}`} disabled={isDeleting} onClick={() => { setIsDeleting(true); setError(false); void onDelete().catch(() => setError(true)).finally(() => setIsDeleting(false)); }} type="button" variant="ghost">
          <Trash2 aria-hidden="true" size={16} />
          {isDeleting ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
      {error ? <small aria-live="polite" className="profile-fdr-saved-palette__error" role="alert">Could not delete this palette.</small> : null}
    </div>
  );
}

function AppearanceSettingsCard({
  preset,
  saveStatus,
  setThemeAccentColour,
  setPresetName,
  themeColours,
}: {
  preset: ThemePreset;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  setPresetName: (presetName: ThemePreset['name']) => void;
  setThemeAccentColour: (accent: ThemeAccent, colour: string) => void;
  themeColours: ThemeAccentColours;
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
      <ThemeColourControls onSelect={setThemeAccentColour} themeColours={themeColours} />
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
      <ProfileSettingsSwitch
        checked={fdrScaleReversed}
        className="profile-fdr-reverse-toggle"
        label="Reverse order"
        onChange={onSetFdrScaleReversed}
      />
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
      <div aria-label="Attacking direction" className="profile-direction-grid" role="group">
        <DirectionOption direction="up" isSelected={attackDirection === 'up'} onSelect={() => onSetAttackDirection('up')} />
        <DirectionOption direction="down" isSelected={attackDirection === 'down'} onSelect={() => onSetAttackDirection('down')} />
      </div>
    </Card>
  );
}

function ProfileSettingsSwitch({
  checked,
  className = '',
  description,
  label,
  onChange,
}: {
  checked: boolean;
  className?: string;
  description?: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`profile-settings-switch ${className}`.trim()}>
      <span className="profile-settings-switch__copy">
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <input aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span aria-hidden="true" className="profile-settings-switch__track">
        <span className="profile-settings-switch__thumb" />
      </span>
    </label>
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
  const [isCustomOpen, setIsCustomOpen] = useState(fdrScale === 'CustomHex' || fdrScale === 'CustomAll');
  useEffect(() => setIsCustomOpen(fdrScale === 'CustomHex' || fdrScale === 'CustomAll'), [fdrScale]);

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
            <details className="profile-colour-accordion" id="fdr-custom-accordion" onToggle={(event) => setIsCustomOpen(event.currentTarget.open)} open={isCustomOpen}>
              <summary className="profile-colour-accordion__summary">Custom palette</summary>
              <div className="profile-colour-accordion__content">
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
                {customFdrPalettes.length ? (
                  <div aria-label="Saved custom FDR palettes" className="profile-fdr-saved-palettes">
                    <div className="profile-fdr-saved-palettes__header">
                      <h4>Saved palettes</h4>
                    </div>
                    {customFdrPalettes.map((palette) => (
                      <SavedFdrPaletteOption
                        key={palette.id}
                        onDelete={() => deleteCustomFdrPalette(palette.id)}
                        onUse={() => {
                          onUseCustomFdrPalette(palette);
                          onClose();
                        }}
                        palette={palette}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
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
      </span>
      <span aria-hidden="true" className="profile-preset-check">
        {isSelected ? <Check size={15} /> : <Circle size={15} />}
      </span>
    </button>
  );
}

const themeAccentDefinitions: Array<{ accent: ThemeAccent; label: string }> = [
  { accent: 'primary', label: 'Primary accent' },
  { accent: 'secondary', label: 'Secondary accent' },
  { accent: 'tertiary', label: 'Tertiary accent' },
];

function ThemeColourControls({
  themeColours,
  onSelect,
}: {
  themeColours: ThemeAccentColours;
  onSelect: (accent: ThemeAccent, colour: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details className="profile-colour-accordion profile-theme-colours" id="theme-colours-accordion" onToggle={(event) => setIsOpen(event.currentTarget.open)} open={isOpen}>
      <summary className="profile-colour-accordion__summary" id="main-theme-colour-title">Custom theme colours</summary>
      <div className="profile-colour-accordion__content">
        {themeAccentDefinitions.map(({ accent, label }) => (
          <div className="profile-theme-colour-row" data-theme-colour-accent={accent} key={accent}>
            <strong>{label}</strong>
            <div aria-label={label + ' choices'} className="profile-theme-colour-options" role="group">
              {themeColourOptions.map((option) => (
                <button
                  aria-label={option.label + ' ' + accent + ' theme colour'}
                  aria-pressed={themeColours[accent] === option.colour}
                  className={'profile-theme-colour-swatch' + (themeColours[accent] === option.colour ? ' is-selected' : '')}
                  key={option.label}
                  onClick={() => onSelect(accent, option.colour)}
                  style={{ '--swatch-colour': option.colour } as CSSProperties}
                  title={label + ': ' + option.label}
                  type="button"
                />
              ))}
              <label className="profile-theme-colour-picker">
                <span className="sr-only">Choose a custom {accent} theme colour</span>
                <input
                  aria-label={'Custom ' + accent + ' theme colour'}
                  onChange={(event) => onSelect(accent, event.target.value)}
                  type="color"
                  value={themeColours[accent]}
                />
              </label>
            </div>
          </div>
        ))}
        <div aria-label="Theme accent preview" className="profile-theme-colour-variants">
          {themeAccentDefinitions.map(({ accent, label }) => (
            <div className="profile-theme-colour-variant" key={accent}>
              <strong>{label}</strong>
              <div className="profile-theme-colour-variant__swatches">
                <span style={{ '--swatch-colour': getThemeColourForMode(themeColours[accent], 'light') } as CSSProperties}>Light</span>
                <span style={{ '--swatch-colour': getThemeColourForMode(themeColours[accent], 'dark') } as CSSProperties}>Dark</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
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
        </button>
        <button
          aria-pressed={mode === 'all'}
          className={`profile-fdr-custom-editor__mode${mode === 'all' ? ' is-selected' : ''}`}
          onClick={() => setMode('all')}
          type="button"
        >
          <strong>Custom every colour</strong>
        </button>
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
      <ColourPaletteSelector
        ariaLabel="Custom FDR colours"
        columns={customColourKeys.length}
        onSelect={(id) => setActiveKey(id as CustomColourKey)}
        options={customColourKeys.map((key, index) => {
          const isEditable = editableKeys.includes(key);
          const colour = mode === 'anchors'
            ? getFdrFillPalette('CustomHex', 'light', false, anchors)[index]
            : anchors[key];
          return {
            ariaLabel: `Edit FDR ${index + 1} colour`,
            colour,
            disabled: !isEditable,
            foregroundColor: getFdrFillForeground(colour),
            id: key,
            label: String(index + 1),
            secondaryLabel: isEditable ? undefined : 'Auto',
          };
        })}
        selectedId={selectedKey}
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
      </span>
      <span aria-hidden="true" className="profile-preset-check">
        {isSelected ? <Check size={15} /> : <Circle size={15} />}
      </span>
    </button>
  );
}

export default ProfilePage;
