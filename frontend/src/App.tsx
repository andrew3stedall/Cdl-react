import { type FormEvent, useEffect, useState } from 'react';

import {
  canAccessProtectedRoute,
  defaultSessionClient,
  getUnauthenticatedSession,
  type SessionClient,
} from './auth';
import { AppShell } from './AppShell';
import { AnalyticsDashboardPage } from './AnalyticsDashboardPage';
import type { RuleSection, SessionState } from './contracts';
import type { DashboardClient } from './dashboard-api';
import { FixtureDifficultyPage } from './FixtureDifficultyPage';
import type { FdrClient } from './fdr-api';
import { LeaguePage } from './LeaguePage';
import type { LeagueClient } from './league-api';
import { ModernisationCheckpointPage } from './ModernisationCheckpointPage';
import type { PreferenceClient } from './preferences-api';
import { RulesPage } from './RulesPage';
import { SquadManagementPage } from './SquadManagementPage';
import { TeamSelectionPage } from './TeamSelectionPage';
import type { TeamSelectionClient } from './team-selection-api';
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
  {
    id: 'lineup-validation',
    title: 'Lineup Validation',
    category: 'squads',
    summary: 'Lineups must satisfy starter, bench, reserve, and captaincy rules.',
    body: ['Team selection validation links to this stable rule identifier.'],
    tags: ['team-selection', 'validation'],
    anchors: ['lineup-validation'],
    relatedRuleIds: ['chip-usage', 'captaincy'],
    version: rulesVersion,
  },
  {
    id: 'chip-usage',
    title: 'Chip Usage',
    category: 'squads',
    summary: 'Only one unused chip can be active at a time.',
    body: ['Used chips cannot be reactivated.'],
    tags: ['chips', 'team-selection'],
    anchors: ['chip-usage'],
    relatedRuleIds: ['lineup-validation'],
    version: rulesVersion,
  },
];

interface AppProps {
  dashboardClient?: DashboardClient;
  fdrClient?: FdrClient;
  initialPath?: string;
  leagueClient?: LeagueClient;
  preferenceClient?: PreferenceClient;
  session?: SessionState;
  sessionClient?: SessionClient;
  teamSelectionClient?: TeamSelectionClient;
}

export function App({
  dashboardClient,
  fdrClient,
  initialPath = window.location.pathname,
  leagueClient,
  preferenceClient,
  session,
  sessionClient = defaultSessionClient,
  teamSelectionClient,
}: AppProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [activeSession, setActiveSession] = useState<SessionState | null>(session ?? null);
  const [isMobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const preset = getDefaultThemePreset();

  useEffect(() => {
    let cancelled = false;

    if (session !== undefined) {
      setActiveSession(session);
      return () => {
        cancelled = true;
      };
    }

    setActiveSession(null);
    void sessionClient.getSession()
      .then((resolvedSession) => {
        if (!cancelled) {
          setActiveSession(resolvedSession);
          if (!canAccessProtectedRoute(resolvedSession)) {
            try {
              window.history.replaceState({}, '', '/login');
            } catch {
              // Browser history can be unavailable in isolated DOM tests.
            }
            setCurrentPath('/login');
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveSession(getUnauthenticatedSession());
          try {
            window.history.replaceState({}, '', '/login');
          } catch {
            // Browser history can be unavailable in isolated DOM tests.
          }
          setCurrentPath('/login');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, sessionClient]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setMobileNavigationOpen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const setBrowserPath = (href: string, replace = false) => {
    try {
      if (replace) {
        window.history.replaceState({}, '', href);
      } else {
        window.history.pushState({}, '', href);
      }
    } catch {
      // Browser history can be unavailable in isolated DOM tests.
    }
    setCurrentPath(href);
  };

  const refreshActiveSession = async () => {
    if (session !== undefined) return;
    setActiveSession(null);
    try {
      const resolvedSession = await sessionClient.getSession();
      setActiveSession(resolvedSession);
      if (!canAccessProtectedRoute(resolvedSession)) {
        setBrowserPath('/login', true);
      }
    } catch {
      setActiveSession(getUnauthenticatedSession());
      setBrowserPath('/login', true);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    setLoginPending(true);

    try {
      const result = await sessionClient.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (!result.ok) {
        setLoginError(result.error.message);
        return;
      }

      setLoginPassword('');
      setMobileNavigationOpen(false);
      setBrowserPath('/', true);
      setActiveSession(result.data.session);
    } catch {
      setLoginError('Sign in is temporarily unavailable. Try again.');
    } finally {
      setLoginPending(false);
    }
  };

  const handleSignOut = async () => {
    setActiveSession(null);
    setBrowserPath('/login', true);
    if (session !== undefined) {
      setActiveSession(getUnauthenticatedSession());
      return;
    }
    try {
      const response = await sessionClient.logout();
      setActiveSession(response.session);
    } catch {
      setActiveSession(getUnauthenticatedSession());
    }
  };

  const handleNavigate = (href: string) => {
    setBrowserPath(href);
  };

  if (activeSession === null) {
    return (
      <main className="session-boundary" aria-label="Protected route session state">
        <h1>Castle Draft League</h1>
        <div className="login-required" role="status">
          Checking your session…
        </div>
      </main>
    );
  }

  if (!canAccessProtectedRoute(activeSession)) {
    return (
      <main className="session-boundary" aria-label="Protected route session state">
        <h1>Sign in to CDL Manager</h1>
        <button
          aria-expanded={isMobileNavigationOpen}
          onClick={() => setMobileNavigationOpen((isOpen) => !isOpen)}
          type="button"
        >
          Menu
        </button>
        <nav aria-label="Primary navigation">
          <a
            href="/login"
            onClick={(event) => {
              event.preventDefault();
              setBrowserPath('/login', true);
            }}
          >
            Dashboard
          </a>
        </nav>
        <p className="login-required" role="status">
          Sign in to access the Castle Draft League application shell.
        </p>
        <form className="login-form" onSubmit={(event) => void handleLogin(event)}>
          <label className="login-field">
            <span>Email address</span>
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => setLoginEmail(event.target.value)}
              required
              type="email"
              value={loginEmail}
            />
          </label>
          <label className="login-field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setLoginPassword(event.target.value)}
              required
              type="password"
              value={loginPassword}
            />
          </label>
          {loginError ? (
            <p className="login-error" role="status">
              {loginError}
            </p>
          ) : null}
          <div className="login-actions">
            <button className="ui-button ui-button-primary" disabled={loginPending} type="submit">
              {loginPending ? 'Signing in…' : 'Sign in'}
            </button>
            {session === undefined ? (
              <button
                className="ui-button ui-button-secondary"
                disabled={loginPending}
                onClick={() => void refreshActiveSession()}
                type="button"
              >
                Retry session
              </button>
            ) : null}
          </div>
        </form>
      </main>
    );
  }

  let routeContent = <RulesPage categories={['squads', 'trades']} sections={featuredRules} preset={preset} />;

  if (currentPath.startsWith('/league')) {
    routeContent = <LeaguePage leagueClient={leagueClient} />;
  }

  if (currentPath.startsWith('/modernisation/checkpoint-1')) {
    routeContent = <ModernisationCheckpointPage />;
  }

  if (currentPath.startsWith('/modernisation/checkpoint-2')) {
    routeContent = <ModernisationCheckpointPage checkpoint={2} />;
  }

  if (currentPath.startsWith('/modernisation/checkpoint-3')) {
    routeContent = <ModernisationCheckpointPage checkpoint={3} />;
  }

  if (currentPath.startsWith('/modernisation/checkpoint-4')) {
    routeContent = <ModernisationCheckpointPage checkpoint={4} />;
  }

  if (currentPath.startsWith('/modernisation/checkpoint-5')) {
    routeContent = <ModernisationCheckpointPage checkpoint={5} />;
  }

  if (currentPath.startsWith('/dashboard')) {
    routeContent = <AnalyticsDashboardPage dashboardClient={dashboardClient} />;
  }

  if (currentPath.startsWith('/fdr')) {
    routeContent = <FixtureDifficultyPage fdrClient={fdrClient} />;
  }

  if (currentPath.startsWith('/squad-management')) {
    routeContent = <SquadManagementPage preset={preset} />;
  }

  if (currentPath.startsWith('/team-selection')) {
    routeContent = <TeamSelectionPage preset={preset} teamSelectionClient={teamSelectionClient} />;
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
          void refreshActiveSession();
        }}
        onSignOut={() => void handleSignOut()}
        session={activeSession}
      >
        <p className="eyebrow">Data refreshes: {refreshCount}</p>
        {routeContent}
      </AppShell>
    </ThemePresetProvider>
  );
}
