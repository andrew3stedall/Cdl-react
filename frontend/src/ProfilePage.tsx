import type { CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Check, Circle, LogOut, Moon, RefreshCw, Sun } from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { AttackDirection, SessionState, ThemePreset } from './contracts';
import { themePresets, getThemeMode } from './theme-presets';
import { useThemePreset } from './theme-preset-provider';
import './profile-page.css';

interface ProfilePageProps {
  onRefresh: () => void;
  onSignOut: () => void;
  session: SessionState;
}

export function ProfilePage({ onRefresh, onSignOut, session }: ProfilePageProps) {
  const { attackDirection, preset, saveStatus, setAttackDirection, setPresetName } = useThemePreset();
  const user = session.user;
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
        <small>{isUp ? 'Forwards at the top of the pitch' : 'Forwards at the bottom of the pitch'}</small>
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
