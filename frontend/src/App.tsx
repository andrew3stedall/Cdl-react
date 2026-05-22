import { useState } from 'react';

import { canAccessProtectedRoute } from './auth';
import { AppShell } from './AppShell';
import type { RuleSection, SessionState } from './contracts';
import { LeaguePage } from './LeaguePage';
import type { LeagueClient } from './league-api';
import type { PreferenceClient } from './preferences-api';
import { RulesPage } from './RulesPage';
import { SquadManagementPage } from './SquadManagementPage';
import { getDefaultThemePreset } from './theme-presets';
import { ThemePresetProvider } from './theme-preset-provider';

const rulesVersion = {
  version: '2026.05',
  effectiveDate: '2026-05-22',
  status: 'active',
  source: 'docs/features/active/rules-knowledge-base.md',
};

const featuredRules: RuleSection[] = [
  {
    id: 'squad-size',
    title: 'Squad Size',
    category: 'squads',
    summary: 'Squads must remain within approved roster limits.',
    body: ['Validation errors should link to this stable rule identifier.'],
    tags: ['squad', 'validation'],
    anchors: ['squad-size'],
    relatedRuleIds: ['transfer-deadline'],
    version: rulesVersion,
  },
  {
    id: 'trade-window',
    title: 'Trade Window',
    category: 'trades',
    summary: 'Trades are only valid during configured trade windows.',
    body: ['Trade proposals can only be accepted while the trade window is open.'],
    tags: ['trades', 'commissioner'],
    anchors: ['trade-window'],
    relatedRuleIds: ['commissioner-decisions'],
    version: rulesVersion,
  },
];

const defaultSession: SessionState = {
  isAuthenticated: true,
  user: {
    id: 'demo-manager',
    email: 'manager@example.com',
    displayName: 'CDL Manager',
    roles: ['manager'],
  },
  expiresAt: null,
};

interface AppProps {
  initialPath?: string;
  leagueClient?: LeagueClient;
  preferenceClient?: PreferenceClient;
  session?: SessionState;
}

export function App({
  initialPath = window.location.pathname,
  leagueClient,
  preferenceClient,
  session = defaultSession,
}: AppProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [isMobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const preset = getDefaultThemePreset();

  const handleNavigate = (href: string) => {
    try {
      window.history.pushState({}, '', href);
    } catch {
      // Browser history can be unavailable in isolated DOM tests.
    }

    setCurrentPath(href);
  };

  if (!canAccessProtectedRoute(session)) {
    return (
      <main className="session-boundary" aria-label="Protected route session state">
        <h1>Castle Draft League</h1>
        <div className="login-required" role="status">
          Sign in to access the Castle Draft League application shell.
        </div>
      </main>
    );
  }

  let routeContent = <RulesPage categories={['squads', 'trades']} sections={featuredRules} preset={preset} />;

  if (currentPath.startsWith('/league')) {
    routeContent = <LeaguePage leagueClient={leagueClient} />;
  }

  if (currentPath.startsWith('/squad-management')) {
    routeContent = <SquadManagementPage preset={preset} />;
  }

  return (
    <ThemePresetProvider preferenceClient={preferenceClient}>
      <AppShell
        currentPath={currentPath}
        isMobileNavigationOpen={isMobileNavigationOpen}
        onCloseMobileNavigation={() => {
          setMobileNavigationOpen(false);
        }}
        onNavigate={handleNavigate}
        onOpenMobileNavigation={() => {
          setMobileNavigationOpen(true);
        }}
        onRefresh={() => {
          setRefreshCount((count) => count + 1);
        }}
        session={session}
      >
        <p className="eyebrow">Data refreshes: {refreshCount}</p>
        {routeContent}
      </AppShell>
    </ThemePresetProvider>
  );
}
