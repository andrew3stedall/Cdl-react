import { LogOut, RefreshCw, UserRound } from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Select } from './components/ui/select';
import type { SessionState, ThemePreset } from './contracts';
import { themePresets } from './theme-presets';
import { useThemePreset } from './theme-preset-provider';

interface ManagerAccountSectionProps {
  onNavigate: (href: string) => void;
  onRefresh: () => void;
  onSignOut: () => void;
  session: SessionState;
}

export function ManagerAccountSection({
  onNavigate,
  onRefresh,
  onSignOut,
  session,
}: ManagerAccountSectionProps) {
  const { preset, saveStatus, setPresetName } = useThemePreset();
  const displayName = session.user?.displayName ?? 'Authenticated user';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CD';

  return (
    <Card aria-label="Account settings" className="manager-account-section">
      <div className="manager-account-section__summary">
        <span aria-hidden="true" className="manager-account-section__avatar">{initials}</span>
        <div>
          <strong>{displayName}</strong>
          <span>Signed in</span>
        </div>
      </div>

      <div className="manager-account-section__appearance">
        <h2>Appearance</h2>
        <PresetSelector
          controlId="manager-desk-visual-preset"
          preset={preset}
          saveStatus={saveStatus}
          setPresetName={setPresetName}
        />
      </div>

      <div className="manager-account-section__actions">
        <Button onClick={() => onNavigate('/profile')} type="button" variant="secondary">
          <UserRound aria-hidden="true" size={18} />
          Profile &amp; preferences
        </Button>
        <Button onClick={onRefresh} type="button" variant="secondary">
          <RefreshCw aria-hidden="true" size={18} />
          Refresh data
        </Button>
        <Button onClick={onSignOut} type="button" variant="ghost">
          <LogOut aria-hidden="true" size={18} />
          Sign out
        </Button>
      </div>
    </Card>
  );
}

export function PresetSelector({
  controlId,
  preset,
  saveStatus,
  setPresetName,
}: {
  controlId: string;
  preset: ThemePreset;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  setPresetName: (presetName: ThemePreset['name']) => void;
}) {
  return (
    <div className="preset-control">
      <Select
        aria-label="Visual preset"
        id={controlId}
        label="Appearance"
        onChange={(event) => setPresetName(event.target.value as ThemePreset['name'])}
        options={themePresets.map((themePreset) => ({
          label: themePreset.label,
          value: themePreset.name,
        }))}
        value={preset.name}
      />
      <span aria-live="polite" className="preset-save-status">
        {saveStatus === 'saving' ? 'Saving appearance' : null}
        {saveStatus === 'saved' ? 'Appearance saved' : null}
        {saveStatus === 'error' ? 'Using local appearance fallback' : null}
      </span>
    </div>
  );
}
