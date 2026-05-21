import type { ReactNode } from 'react';
import { LogOut, Menu, RefreshCw, Search } from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Select } from './components/ui/select';
import { Sheet } from './components/ui/sheet';
import type { SessionState, ThemePreset } from './contracts';
import { isRouteActive, primaryNavigationItems, type NavigationItem } from './navigation';
import { themePresets } from './theme-presets';
import { useThemePreset } from './theme-preset-provider';

interface AppShellProps {
  children: ReactNode;
  currentPath: string;
  isMobileNavigationOpen: boolean;
  onCloseMobileNavigation: () => void;
  onNavigate: (href: string) => void;
  onOpenMobileNavigation: () => void;
  onRefresh: () => void;
  session: SessionState;
}

export function AppShell({
  children,
  currentPath,
  isMobileNavigationOpen,
  onCloseMobileNavigation,
  onNavigate,
  onOpenMobileNavigation,
  onRefresh,
  session,
}: AppShellProps) {
  const { preset, saveStatus, setPresetName } = useThemePreset();

  const navigate = (item: NavigationItem) => {
    onNavigate(item.href);
    onCloseMobileNavigation();
  };

  return (
    <div className="app-shell" data-theme-preset={preset.name}>
      <aside className="app-sidebar" aria-label="Primary navigation">
        <ShellBrand />
        <NavigationList currentPath={currentPath} onNavigate={navigate} />
      </aside>

      <Sheet id="mobile-navigation" isOpen={isMobileNavigationOpen} labelledBy="mobile-navigation-title">
        <div className="mobile-sheet-header">
          <h2 id="mobile-navigation-title">Navigation</h2>
          <Button onClick={onCloseMobileNavigation} type="button" variant="ghost">
            Close
          </Button>
        </div>
        <NavigationList currentPath={currentPath} onNavigate={navigate} />
      </Sheet>

      <main className="shell-main">
        <header className="shell-header">
          <Button
            aria-controls="mobile-navigation"
            aria-expanded={isMobileNavigationOpen}
            className="mobile-menu-button"
            onClick={onOpenMobileNavigation}
            type="button"
            variant="secondary"
          >
            <Menu aria-hidden="true" size={18} />
            Menu
          </Button>

          <div className="shell-heading">
            <span className="eyebrow">Castle Draft League</span>
            <h1>Application Shell</h1>
          </div>

          <div className="shell-actions" aria-label="Shell actions">
            <Button onClick={onRefresh} type="button" variant="secondary">
              <RefreshCw aria-hidden="true" size={16} />
              Reload
            </Button>
            <a
              className="scouting-link"
              href="/scouting"
              onClick={(event) => {
                event.preventDefault();
                onNavigate('/scouting');
              }}
            >
              <Search aria-hidden="true" size={16} />
              Scouting
            </a>
            <PresetSelector preset={preset} saveStatus={saveStatus} setPresetName={setPresetName} />
            <Button type="button" variant="ghost">
              <LogOut aria-hidden="true" size={16} />
              Sign out
            </Button>
          </div>
        </header>

        <Card className="session-card" aria-label="Authenticated session">
          <span>Signed in as {session.user?.displayName ?? 'Authenticated user'}</span>
          <span>Preset: {preset.label}</span>
        </Card>

        {children}
      </main>
    </div>
  );
}

function ShellBrand() {
  return (
    <div className="shell-brand">
      <span className="brand-mark">CDL</span>
      <div>
        <strong>Castle Draft League</strong>
        <span>Modern manager workspace</span>
      </div>
    </div>
  );
}

function NavigationList({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate: (item: NavigationItem) => void;
}) {
  return (
    <nav className="navigation-list">
      {primaryNavigationItems.map((item) => {
        const isActive = isRouteActive(currentPath, item.href);

        return (
          <button
            aria-current={isActive ? 'page' : undefined}
            className={isActive ? 'nav-item active' : 'nav-item'}
            key={item.href}
            onClick={() => {
              onNavigate(item);
            }}
            type="button"
          >
            <span>{item.label}</span>
            {item.supportsScouting ? <small>Scouting enabled</small> : null}
          </button>
        );
      })}
    </nav>
  );
}

function PresetSelector({
  preset,
  saveStatus,
  setPresetName,
}: {
  preset: ThemePreset;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  setPresetName: (presetName: ThemePreset['name']) => void;
}) {
  return (
    <div className="preset-control">
      <Select
        aria-label="Visual preset"
        label="Preset"
        onChange={(event) => {
          setPresetName(event.target.value as ThemePreset['name']);
        }}
        options={themePresets.map((themePreset) => ({
          label: themePreset.label,
          value: themePreset.name,
        }))}
        value={preset.name}
      />
      <span aria-live="polite" className="preset-save-status">
        {saveStatus === 'saving' ? 'Saving preset' : null}
        {saveStatus === 'saved' ? 'Preset saved' : null}
        {saveStatus === 'error' ? 'Using local preset fallback' : null}
      </span>
    </div>
  );
}
